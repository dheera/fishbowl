# Fishbowl

A full-screen, touch-reactive aquarium for cats, built as a static HTML site. It uses Canvas 2D and locally generated artwork: no framework, video stream, WebGL requirement, build step, or third-party requests. An Android app is not required; Fully Kiosk supplies the tablet's display and kiosk controls.

## Run on your LAN

Serve this directory from a computer on the same network as the tablet:

```sh
cd /home/dheera/code/fishbowl
python3 -m http.server 8080 --bind 0.0.0.0
```

Open `http://YOUR-SERVER-LAN-IP:8080/` on the tablet. Replace the placeholder with your server's address, for example `192.168.1.50`; `localhost` on the tablet refers to the tablet itself. Allow port 8080 through the server firewall on your local network. A router DHCP reservation keeps the address stable. The Python process and server computer must remain running for new page loads; any existing static web server, such as nginx or Caddy, can serve the same files for permanent hosting.

All application files load from that server. Once loaded, the aquarium does not need an Internet connection or ongoing server requests. After a page reload, the server must be reachable again. There is no service worker or guaranteed offline installation.

## Controls

- Touch or drag across the water to interact with the fish; simultaneous touches are supported.
- Hold the top-right corner for 1.2 seconds, or press **S** on a keyboard, to open the owner controls.
- Adjust the fish population, swimming speed, lighting, and performance settings there. Preferences are saved in this browser when local storage is available.
- Touches, catches, escapes, and feeding make soft synthesized bubble sounds. Audio starts with the first touch; adjust **Interaction sounds** down to zero to mute. Set the tablet's media volume as desired. No sound files or Internet access are needed.
- A caught fish wriggles under the paw, then slips away and is replaced with a new individual. **Sprinkle food** brings fish together; **New fish** starts a fresh shoal.
- Use the full-screen control when running in an ordinary browser. Fully Kiosk can start the page in full screen directly.

The animation has no end state. Fish wander in depth as well as across the tank: a perspective model makes them grow as they approach the glass and recede as they swim away, without pre-scripted paths or a fixed sequence. Fish are replenished over time, and temporary touch effects are discarded after they finish. The rendering approach favors bounded work and memory use over a heavy 3D simulation.

## Samsung tablet / Fully Kiosk setup

Use **Fully Kiosk Browser**, with Android System WebView updated to a version that works well on your tablet. The Galaxy Tab A9 should be a suitable target for this Canvas 2D approach, but actual frame rate and unattended reliability need checking on the physical device. Start with the default performance setting and reduce it if the tablet becomes warm or motion stutters.

Set the following in Fully Kiosk:

| Section | Setting |
| --- | --- |
| Web Content Settings | **Start URL**: `http://YOUR-SERVER-LAN-IP:8080/` |
| Toolbars and Appearance | Turn off **Show Navigation Bar**, **Show Status Bar**, and **Show Action Bar**. Hide the address bar if enabled. |
| Device Management | Enable **Keep Screen On** and **Launch on Boot**. Choose landscape under **Force Screen Orientation** if desired. Disable screen-off timers for continuous display. |
| Web Browsing Settings | Enable **Wait for Network Connection**. Disable **Enable Pull to refresh**, so swipes remain aquarium interactions. |
| Advanced Web Settings | Leave **Enable User Interaction** and **Enable Dragging** enabled. Use the default hardware graphics acceleration. |
| Web Auto Reload | Enable **Auto Reload after Page Error** with a short delay, such as 15 seconds, and **Auto Reload on Network Reconnect**. Leave **Delete Webstorage on Auto Reload** off to preserve aquarium preferences. |

Fully documents the [Start URL](https://www.fully-kiosk.com/docs/en/configuration/web-content), [display controls](https://www.fully-kiosk.com/docs/en/configuration/toolbars-appearance), [keep-awake and startup controls](https://www.fully-kiosk.com/docs/en/configuration/device-management), [touch and browsing controls](https://www.fully-kiosk.com/docs/en/configuration/web-browsing), [advanced web settings](https://www.fully-kiosk.com/docs/en/configuration/advanced-web), and [reload settings](https://www.fully-kiosk.com/docs/en/configuration/web-auto-reload).

For a LAN-only aquarium, leave **Auto Reload on Internet Reconnect** off: it checks public Internet connectivity rather than your aquarium server. Also leave **Load Error URL on Disconnection** off, so losing Internet access does not replace an already-running aquarium. Network reconnection and page-load error recovery are the relevant options here. [Fully's connection handling](https://www.fully-kiosk.com/docs/en/faq/errors)

For stronger protection against accidental exits, enable **Kiosk Mode**, set an exit PIN, and choose a corner-based exit gesture instead of repeated taps anywhere. Kiosk Mode is a **PLUS** feature. Under **Other Settings**, **Restart Fully After Crash** and **Restart Fully After Update** are also PLUS features; the update restart requires Kiosk Mode. **Restart on Unresponsiveness** in Advanced Web Settings is an optional PLUS, experimental recovery feature. [Kiosk settings](https://www.fully-kiosk.com/docs/en/configuration/kiosk-mode), [restart settings](https://www.fully-kiosk.com/docs/en/configuration/other), [unresponsiveness setting](https://www.fully-kiosk.com/docs/en/configuration/advanced-web)

Use Fully's **Keep Screen On** for this HTTP LAN setup. The browser Screen Wake Lock API requires a secure context, so an ordinary `http://192.168.…` address cannot be relied on to hold the screen awake. [Screen Wake Lock specification](https://www.w3.org/TR/screen-wake-lock/)

## Long-running use

The site is designed to keep simulating without scheduled reloads. Android can still terminate WebView or the kiosk app, including during updates; Fully's recovery options help but cannot guarantee uninterrupted operation. Check a long run on your actual tablet, including a reboot and temporary Wi-Fi loss. A static page cannot revive itself after its browser process has been killed. [Fully's crash guidance](https://www.fully-kiosk.com/docs/en/faq/crash)

Keep the tablet powered and use a comfortable device brightness. The aquarium's lighting control changes the scene; the Android/Fully brightness setting controls the display's power use. No camera, microphone, or motion-detection permission is needed for the aquarium.

## Verification

Run `node tests/simulation.test.cjs --quick` for the behavior checks, or `node tests/simulation.test.cjs` to include six simulated hours at the maximum population. These run the real simulation with mocked browser drawing and audio; they verify population replenishment, bounded effects, depth changes, frame scheduling, resizing, and background/resume behavior. They do not measure physical tablet performance or battery use. The six-hour simulation and browser visual checks passed during development.

The generated backdrop and its original imagegen prompt are documented in [assets/README.md](assets/README.md). The runtime loads only `index.html`, `style.css`, `aquarium.js`, `fish-art.js`, `audio.js`, and the two image assets. No installation or build step is needed.
# fishbowl
