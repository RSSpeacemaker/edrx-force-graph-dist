import { CSS2DRenderer, CSS2DObject } from './modules/CSS2DRenderer.js';
import colors from './colors.json' assert { type: 'json' }

const backgroundColor = colors.blue;

const button = document.createElement('button')
button.innerText = "start";

button.style.position =         "absolute";
button.style.top =              "50%";
button.style.left =             "50%";
button.style.border =           "3px solid white";
button.style.color =            "white";
button.style.background =       "black";
button.style.opacity =          "50%";
button.style.borderRadius =     "30px";
button.style.height =           "50px";
button.style.width =            "100px";
button.style.fontSize =         "1.5em";
button.style.transform =        "translate(-50%,-50%)";
document.body.appendChild(button);
document.body.style.backgroundColor = backgroundColor;

button.addEventListener('click', () => {
  renderGraph()
  button.remove()
});

function renderGraph() {
  // const nodeColorScale = d3.scaleOrdinal(d3.schemeRdYlGn[4]);

  const Graph = ForceGraph3D({
    extraRenderers: [new CSS2DRenderer()]
  })
  (document.getElementById('3d-graph'))
    .jsonUrl("./database.json")
    .backgroundColor(colors.blue)
    .linkOpacity(0.2)
    .linkCurvature(0.1)
    .numDimensions(3)
    .nodeThreeObject(node => {
      node.color = colors.yellow
      const nodeEl = document.createElement('div');
      nodeEl.textContent =            node.name;
      nodeEl.className =              'node-label';
      nodeEl.style.color =            colors.white;
      nodeEl.style.opacity =          "100%";
      nodeEl.style.borderRadius =     "30px";
      nodeEl.style.height =           "auto";
      nodeEl.style.width =            "auto";
      nodeEl.style.fontSize =         "1.2em";
      nodeEl.style.marginTop =        "20px";
      nodeEl.style.opacity =          "80%";

      node.name = null

      return new CSS2DObject(nodeEl);
    })
    // .linkColor( () => colors.yellow )
    .linkThreeObject(link => {
      link.color = colors.yellow
    })
    .nodeThreeObjectExtend(true)
}