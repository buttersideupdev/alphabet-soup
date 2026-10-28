# Letter Thief

A chef who climbs onto whichever text box you click, sets a soup pot on its edge, and steals the
first of every letter and number you type, leaving a space where each one was. Click another box
and they follow you. Once all 36 are in the pot, the chef packs up and leaves for good.

Nobody needs this. It's built properly anyway.

## Add it to any page

One line, anywhere in the page:

```html
<script src="https://cdn.jsdelivr.net/gh/buttersideupdev/letter-thief@1/letter-thief.js"></script>
```

That's it. There are no dependencies, no build step and no styles to add.

## What it touches, and what it doesn't

- **Works on** `<textarea>` and `<input>` boxes of type `text`, `search`, `url` and `tel`.
- **Never touches** password, email or number boxes, read-only or disabled boxes, or any box
  marked `data-letter-thief="off"`.

## Options

| Where | What |
|---|---|
| `data-size="0.7"` on the script tag | Chef size for the whole page (1 is normal, 0.5 half, 1.5 bigger). The default, `auto`, shrinks the chef to fit narrow boxes. |
| `data-letter-thief-size="1.4"` on a box | Chef size on that one box |
| `data-letter-thief="off"` on a box | Keep the chef away from it |
| `LetterThief.setSize(0.7)` / `LetterThief.setSize('auto')` | Change the size while the page is open |
| `LetterThief.reset()` | Hire a new chef with an empty pot, even after the last one left |

## How it works

- **Sealed off.** Everything is drawn inside its own shadow DOM, so the page's CSS can't bend the
  chef and the chef's CSS can't leak onto the page.
- **Framework-friendly.** Thefts change the box's value the way the browser does and fire a normal
  `input` event, so React, Vue and friends stay in sync.
- **Pixel-accurate.** To find exactly where a character sits in a box (padding, scrolling and
  wrapping included), it measures an invisible copy of the box.
- **Keeps up with you.** Each edit is compared with the last, so if you type, paste or delete while
  the chef is mid-reach, they still grab the right character. Delete it first and they say "hey!".
- **One thing at a time.** Arriving, stealing and leaving run in order through a small queue, and
  speed up when there's a backlog.
- **Polite.**
  - Screen readers hear each theft ("The chef stole the letter E").
  - "Reduce motion" is respected.
  - Text being composed with an input method is never interrupted.
  - The chef goes quiet when idle: no animation loop runs unless they're busy or their box has
    focus.

## Demo

Try it live at **[buttersideupdev.github.io/letter-thief](https://buttersideupdev.github.io/letter-thief/)**, or open
`index.html` in a browser.

## License

[MIT](LICENSE). Made by [Butter Side Up](https://buttersideup.dev): web apps that land the right way.
