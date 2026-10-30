# Alphabet Soup

A chef who climbs onto whichever text box you click, sets a soup pot on its edge, and steals the
first of every letter and number you type, leaving a space where each one was. Click another box
and they follow you. Once all 36 are in the pot, the chef packs up and leaves for good.

Now and then (about one theft in ten) the chef can't resist and eats one instead, so the next one
of that character you type gets stolen too. And if you want your letters back, click the pot: it
tips over ("non! my soup!"), everything in it spills back into the box in a jumble, still steaming,
and the chef starts collecting all over again.

Nobody needs this. It's built properly anyway.

## Add it to any page

One line, anywhere in the page:

```html
<script src="https://cdn.jsdelivr.net/gh/buttersideupdev/alphabet-soup@2/alphabet-soup.js"></script>
```

That's it. There are no dependencies, no build step and no styles to add.

## What it touches, and what it doesn't

- **Works on** `<textarea>` and `<input>` boxes of type `text`, `search`, `url` and `tel`.
- **Never touches** password, email or number boxes, read-only or disabled boxes, or any box
  marked `data-alphabet-soup="off"` (or inside something marked that way).
- **Politely declines** boxes marked `data-alphabet-soup="decline"`, or inside something marked
  that way, like a whole `<form>`. The first time you click into one, the chef comes over, sniffs,
  says "off duty, this one's important" and leaves without stealing anything. After that the chef
  leaves them alone until the page is reloaded. Handy for contact forms.

## Options

| Where | What |
|---|---|
| `data-size="0.7"` on the script tag | Chef size for the whole page (1 is the full drawing, 0.5 half, 1.5 bigger). The default, `auto`, grows the chef with the box's text (16px text gets the drawing at about 41%) and shrinks them to fit narrow boxes. |
| `data-alphabet-soup-size="1.4"` on a box | Chef size on that one box |
| `data-alphabet-soup="off"` on a box or anything around it | Keep the chef away from it |
| `data-alphabet-soup="decline"` on a box or anything around it | The chef visits once, refuses, and leaves it alone |
| `AlphabetSoup.setSize(0.7)` / `AlphabetSoup.setSize('auto')` | Change the size while the page is open |
| `AlphabetSoup.reset()` | Hire a new chef with an empty pot, even after the last one left |

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
  - Screen readers hear each theft ("The chef stole the letter E"), snack and spill.
  - Clicking the pot doesn't take the focus out of your text box.
  - With "reduce motion" on, the chef moves almost instantly, and says so the first time he
    pops up.
  - Text being composed with an input method is never interrupted.
  - The chef goes quiet when idle: no animation loop runs unless they're busy or their box has
    focus.

## Coming from Letter Thief?

Alphabet Soup 2 is Letter Thief with a new name (and a snacking, pot-spilling chef). The 1.x names
still work: `LetterThief.reset()`, `data-letter-thief="off"` and `data-letter-thief-size`.

## Demo

Try it live at **[buttersideupdev.github.io/alphabet-soup](https://buttersideupdev.github.io/alphabet-soup/)**, or open
`index.html` in a browser.

## License

[MIT](LICENSE). Made by [Butter Side Up](https://buttersideup.dev): web apps that land the right way.
