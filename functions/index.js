const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { onRequest } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const admin = require("firebase-admin");

admin.initializeApp();
const db = admin.firestore();

const SUMUP_API_KEY = defineSecret("SUMUP_API_KEY");
const MERCHANT_CODE = "MWPF6QTA";
const FINES_RETURN_URL = "https://burnabydarts.co.uk/?paid=fines";

// --- Create a Hosted Checkout for a player's outstanding fine ---
exports.createFineCheckout = onCall(
  { secrets: [SUMUP_API_KEY], cors: true },
  async (request) => {
    const { playerId } = request.data;
    if (!playerId) {
      throw new HttpsError("invalid-argument", "playerId is required.");
    }

    // Read the fine total server-side (never trust an amount from the client)
    const playerSnap = await db.collection("players").doc(playerId).get();
    if (!playerSnap.exists) {
      throw new HttpsError("not-found", "Player not found.");
    }
    const stats = playerSnap.data().stats || {};
    const totalPence = Object.values(stats).reduce((sum, season) => {
      return sum + (season?.singles?.outstandingFines || 0);
    }, 0);

    if (totalPence <= 0) {
      throw new HttpsError("failed-precondition", "No outstanding fines.");
    }

    const reference = `fine_${playerId}_${Date.now()}`;
    const amountMajor = (totalPence / 100).toFixed(2);

    const resp = await fetch("https://api.sumup.com/v0.1/checkouts", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${SUMUP_API_KEY.value()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        checkout_reference: reference,
        amount: Number(amountMajor),
        currency: "GBP",
        merchant_code: MERCHANT_CODE,
        description: "Darts fine payment",
        hosted_checkout: { enabled: true },
        redirect_url: FINES_RETURN_URL,
        return_url: "https://us-central1-darts-app-9e752.cloudfunctions.net/sumupWebhook",
      }),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      console.error("SumUp checkout creation failed:", errText);
      throw new HttpsError("internal", "Could not create checkout.");
    }

    const checkout = await resp.json();

    // Remember which player this checkout is for, so the webhook can clear them
    await db.collection("pending_fine_payments").doc(checkout.id).set({
      playerId,
      amountPence: totalPence,
      reference,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return { hostedCheckoutUrl: checkout.hosted_checkout_url };
  }
);

// --- Webhook: SumUp calls this when the checkout status changes ---
exports.sumupWebhook = onRequest(
  { secrets: [SUMUP_API_KEY] },
  async (req, res) => {
    try {
      console.log("Webhook received. Body:", JSON.stringify(req.body));
      const checkoutId = req.body?.id || req.body?.checkout_id;
      if (!checkoutId) {
        console.log("No checkout id found in body.");
        res.status(400).send("No checkout id.");
        return;
      }

      // Verify the real status with SumUp (don't trust the webhook body alone)
      const verify = await fetch(
        `https://api.sumup.com/v0.1/checkouts/${checkoutId}`,
        { headers: { Authorization: `Bearer ${SUMUP_API_KEY.value()}` } }
      );
      const checkout = await verify.json();
      console.log("Verified checkout status:", checkout.status, "id:", checkoutId);

      if (checkout.status !== "PAID") {
        console.log("Status not PAID; ignoring.");
        res.status(200).send("Not paid; ignoring.");
        return;
      }

      const pendingRef = db.collection("pending_fine_payments").doc(checkoutId);
      const pendingSnap = await pendingRef.get();
      if (!pendingSnap.exists) {
        console.log("No pending_fine_payments doc for checkout:", checkoutId);
        res.status(200).send("Unknown checkout; ignoring.");
        return;
      }

      const { playerId } = pendingSnap.data();
      const playerRef = db.collection("players").doc(playerId);
      const playerSnap = await playerRef.get();
      const stats = playerSnap.data().stats || {};

      const updates = {};
      for (const seasonId in stats) {
        updates[`stats.${seasonId}.singles.outstandingFines`] = 0;
      }
      await playerRef.update(updates);

      await db.collection("audit_logs").add({
        action: "fines_cleared",
        targetPlayerId: playerId,
        targetPlayerName: playerSnap.data().name || "Unknown",
        clearedBy: "SumUp online payment",
        checkoutId,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
      });

      await pendingRef.delete();
      res.status(200).send("Fine cleared.");
    } catch (err) {
      console.error("Webhook error:", err);
      res.status(500).send("Webhook error.");
    }
  }
);