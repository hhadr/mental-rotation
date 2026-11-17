# Mental rotation of 3D objects

A short online experiment on spatial imagination, made as a university course project.

You see pairs of 3D objects made of cubes and decide as quickly and accurately as you can whether the right object
is the same as the left one, only rotated, or a different one. It is in the tradition of the classic Shepard and Metzler
mental-rotation task and takes about 10–15 minutes on a computer with a keyboard.

**Take part:** <https://hhadr.github.io/mental-rotation/> (Czech) · [English version](https://hhadr.github.io/mental-rotation/?lang=en)

Participation is voluntary and anonymous. Only answers, response times, the information you enter and basic browser
details are recorded, and they are used for study purposes only.

## Running it locally

It is a static site, so any web server works:

```bash
python3 -m http.server 8000
# then open http://localhost:8000/
```

The objects are rendered with [three.js](https://threejs.org/).
