# Minecraft

Standalone offline browser game. Play it on GitHub Pages, or open `index.html` locally. No install and no account.

## Desktop

- Click the canvas to capture the mouse, then look around.
- **W A S D** or the arrow keys move. **Space** jumps. **Shift** sprints.
- Left click mines or attacks. Right click places.
- **E** opens crafting. **1–9** or the mouse wheel selects the hotbar.
- **R** starts a new world. **Esc** pauses.

## Touch

- The left joystick moves. Drag the right half of the screen to look.
- On-screen buttons: **Jump**, hold **Mine / Attack**, **Place**, **Craft**, and **New World**. Tap the hotbar to select a slot.
- Landscape is the better view. Portrait still plays.

## World

The land is **512 blocks wide and 1024 blocks long** (40 blocks tall). Chunks stream in around you, so distant land stays in memory without being drawn all at once.

## Computers

Two computers sit side by side just north of spawn. The left one is cyan and labeled **材质**. The right one is orange and labeled **建造**. Walk up to one and press **E**. If you can reach both, the nearer one is used (an exact tie uses the material computer). On a phone or tablet, tap the use button. Its label names which computer you are next to. The Craft button does the same while you are next to one. Away from both, **E** still opens crafting.

**材质电脑**

- **是** turns every non-air block into a **diamond block** (a solid block, not diamond ore).
- **否** turns every non-air block into **glass**.
- Air stays air. The space you are standing in is cleared so you are not buried.

**建造电脑**

- **是** scatters houses, towers, halls, and chapels across the map, a few dozen at a time, clear of spawn and both computers. Work is spread across frames. A later **是** adds another round in the gaps, up to 80 buildings, and does not stack them on top of each other.
- **否** does not change any block.

## Verity

Verity is the yellow ball that appears beside you and says “Hi, I'm Verity”. She is not one of the removed hostile white balls. Press **T** near her to chat, or tap **交谈**. Look at her and press **F** to carry her, then **F** again to put her down. On a phone, tap **抱起** and **放下**. Hitting her makes her say “Ouch, why you hit me?” If she is defeated, she comes back beside you.

Her replies are prepared sentences stored in the page, in English and Chinese, about the computers, gravity, missiles, crafting, and carrying her. She is not a live AI. A real chat model would need a separate account, an API key kept out of the page, and a network call.

## Gravity pull

Mining a block, or picking up an item, pulls nearby loose blocks and creatures toward you. The pull covers one cube centered on you that is **10 blocks wide, 10 tall, and 10 deep** (about 5 blocks out in every direction). A glowing outline shows that cube. Bedrock is never pulled, and the pull does not hurt you.
