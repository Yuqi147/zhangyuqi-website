# Yuqi Zhang — Personal Website

Personal website of **Yuqi Zhang**, a Ph.D. student in Astronomy at Boston University,
working on space physics, planetary science, and AI-assisted computational research.

> ⚠️ This site is **under active development** and will be continuously updated.

## Sections

- **Home** — introduction and profile links
- **About** — education, work experience, awards, research interests, biography
- **Research**
- **Projects**
- **Publications**
- **Skills**
- **Contact**
- **CV** — downloadable resume (in [`cv1_yuqi/`](cv1_yuqi/))

The top navigation opens one section at a time. Each section has a shareable
URL (for example, `index.html#research`), and browser Back/Forward works between
sections. Refreshing keeps the selected section. Longer sections scroll normally.
Without JavaScript, all sections remain available as a standard document.

## CV Template

The CV in [`cv1_yuqi/`](cv1_yuqi/) is typeset with the
**[Academic-LaTeX](https://github.com/CunchuanHuang/Academic-LaTeX)** template.

## Local Preview

From this directory, run:

```sh
python3 -m http.server 8765 --bind 127.0.0.1
```

Open [the local preview](http://127.0.0.1:8765/).
There is no build step or JavaScript package installation.

## Repository

Source code and assets for the website. The `cv1_yuqi/` directory also contains the
LaTeX source of the CV; the compiled `main.pdf` is what the website links to.
