---
name: explain-idea
description: Interview the user about an idea and turn it into a narrated video and a shareable interactive static HTML page.
---

1. **Interview.** Use Matt Pocock's [grilling / grill-me](https://github.com/mattpocock/skills) until the audience, takeaway, and flow are clear. Make it smooth sending multiple questions that will maximize the amount of information you'd get.
2. **Agree on the beats.** Use pstack's [teach](https://github.com/backnotprop/pstack/blob/main/skills/teach/SKILL.md) and local `plain-writing` to shape one beat outline for both formats. Get the user's approval before making drafts.
3. **Iterate.** Develop the draft video with quick scratch narration and the interactive HTML in parallel. Show both early and revise in short feedback rounds.
   - **HTML.** Consult [visual-explainer](https://github.com/nicobailon/visual-explainer) and [Vizli](https://github.com/weisberg/agent_tools/blob/main/tools/vizli/skills/explainer/SKILL.md). Let readers change an input and see what happens to the idea they're learning. See [Explorable Explanations](https://worrydream.com/ExplorableExplanations/) and [Parable of the Polygons](https://ncase.me/polygons/).
   - **Video.** Consult Peter Yang's [video-explainer](https://github.com/petergyang/video-explainer) and the [Vox-style collage skill](https://github.com/prakhar2603/collage-skill/blob/main/SKILL.md). Use local Kokoro, image cutouts, ffmpeg, or three.js where they fit.
4. **Produce.** Once the user signs off on the drafts, render the final narration, video, and animations at the highest practical quality. Deliver the narrated video and a shareable static HTML page that runs without a backend.

Read upstream instructions and supporting files only when the current step needs them.
