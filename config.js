window.tailwind = window.tailwind || {};
window.tailwind.config = {
    darkMode: 'class',
};

if (location.protocol !== 'https:' && location.hostname !== 'localhost') {
    location.replace('https:' + window.location.href.substring(window.location.protocol.length));
}
