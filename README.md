# vue-composition-converter

Convert options API and vue-class-component into script setup


## Instructions
1. Clone this repo
2. `npm ci`
3. `npm run dev`
4. Open the web interface and paste your code on the left. New code is on the right. The output is not perfect and will require manual refinement. 


## Notable limitations:

The following elements will be roughly converted, but in a broken state. Manual refinement will be needed.
- Anything accessed from the component instance that the component doesn't own. `$route`, `$router`, `$refs`, `$emit`.
- Class component `@Watch`ers that are provided a string path.
- Vuex usages