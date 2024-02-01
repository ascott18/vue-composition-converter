# vue-composition-converter

Convert options API and vue-class-component into script setup


## Demo

http://ascott18.github.io/vue-composition-converter

## Instructions
1. Acquire the app:
    1. Go to http://ascott18.github.io/vue-composition-converter
    1. OR, Clone this repo, `npm ci`, `npm run dev`
2. Open the web interface and paste your code on the left. New code is on the right. The output is not perfect and will require manual refinement. 


## Notable limitations:

The following elements will be roughly converted, but in a broken state. Manual refinement will be needed.
- Anything accessed from the component instance that the component doesn't own. `$route`, `$router`, `$refs`, `$emit`.
- Class component `@Watch`ers that are provided a string path.
- Vuex usages