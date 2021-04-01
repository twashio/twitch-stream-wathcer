let twiWindow = document.getElementsByClassName("Twitch");
let ytWindow = document.getElementsByClassName("Youtube");
let nicoWindow = document.getElementsByClassName("niconico");

Array.from(twiWindow).forEach(window => {
  window.innerHTML = "【Twitch】"
});
Array.from(ytWindow).forEach(window => {
  window.innerHTML = "【Youtube】"
});
Array.from(nicoWindow).forEach(window => {
  window.innerHTML = "【niconico】"
});