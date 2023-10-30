import { CSS2DRenderer, CSS2DObject } from './CSS2DRenderer.js';

const backgroundColor = "#599CFF";

const button = document.createElement('button')
button.innerText = "start";

button.style.position = "absolute";
button.style.top = "50%";
button.style.left = "50%";
button.style.border = "3px solid white";
button.style.color = "white";
button.style.background = "black";
button.style.opacity = "50%";
button.style.borderRadius = "30px";
button.style.height = "50px";
button.style.width = "100px";
button.style.fontSize = "1.5em";
button.style.transform = "translate(-50%,-50%)";
document.body.appendChild(button);
document.body.style.backgroundColor = backgroundColor;

button.addEventListener('click', () => {
  renderGraph(backgroundColor)
  button.remove()
});

function renderGraph(bgColor) {
  const Graph = ForceGraph3D({
    extraRenderers: [new CSS2DRenderer()]
  })
  (document.getElementById('3d-graph'))
    .jsonUrl("./database.json")
    .backgroundColor(bgColor)
    .linkCurvature(0.1)
    .linkOpacity(0.5)
    .numDimensions(3)
    .nodeAutoColorBy('group')
    .nodeThreeObject(node => {
      const nodeEl = document.createElement('div');
      nodeEl.textContent = node.name;
      nodeEl.style.color = node.color;
      nodeEl.className = 'node-label';
      return new CSS2DObject(nodeEl);
    })
    .nodeThreeObjectExtend(true)
}