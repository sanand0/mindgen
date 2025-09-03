/**
 * mindgen: render/update a draggable, collapsible mindmap.
 *
 * Data model:
 * - Node: { id: string, text: string, pinned?: boolean, children?: Node[] }
 * - Collapsed state is stored on `_children` to preserve subtrees when hidden.
 *
 * @typedef {Object} MindgenOptions
 * @property {number} [margin=20] - Collision padding around each node box.
 * @property {number} [linkDistance=120] - Link distance for d3.forceLink.
 * @property {number} [linkStrength=0.2] - Link strength for d3.forceLink.
 * @property {number} [charge=-500] - Many-body strength (negative repels).
 * @property {number} [centerStrength=0.1] - Strength of centering force.
 * @property {number} [xStrength=0.01] - X gravity strength toward center.
 * @property {number} [yStrength=0.01] - Y gravity strength toward center.
 * @property {number} [alphaDecay=0.02] - Simulation alpha decay.
 * @property {number} [velocityDecay=0.4] - Simulation velocity decay.
 * @property {number} [boundsPadding=10] - Padding to keep nodes inside the container.
 *
 * Usage:
 *   mindgen(data, { margin: 16, linkDistance: 150, charge: -600 });
 */

import { layer } from "https://cdn.jsdelivr.net/npm/@gramex/chartbase@1";

export function mindgen(hierarchyData, options = {}) {
  // 1) Resolve configuration (keep names explicit and approachable)
  const opts = {
    container: "body",
    margin: 40,
    linkDistance: 120,
    linkStrength: 0.2,
    charge: -500,
    centerStrength: 0.1,
    xStrength: 0.01,
    yStrength: 0.01,
    alphaDecay: 0.02,
    velocityDecay: 0.4,
    boundsPadding: 10,
    ...options,
  };

  // 2) Grab DOM, measure container, set up SVG
  const container = d3.select(options.container);
  const svg = layer(container, "svg", "lines");
  const width = container.node().clientWidth;
  const height = container.node().clientHeight;
  svg.attr("width", width).attr("height", height);

  // 3) Build hierarchy and derive flat arrays for simulation + joins
  const root = d3.hierarchy(hierarchyData);
  const nodes = root.descendants();
  const links = root.links();

  // 4) Place nodes: reuse existing DOM positions when re-rendering
  nodes.forEach((node, index) => {
    const id = node.data.id || `node-${index}`;
    const el = document.getElementById(id);

    if (el) {
      const nodeRect = el.getBoundingClientRect();
      const { left, top } = container.node().getBoundingClientRect();
      node.x = nodeRect.left - left + nodeRect.width / 2;
      node.y = nodeRect.top - top + nodeRect.height / 2;
    } else {
      // New nodes: start near center with a small random offset
      node.x ||= width / 2 + (Math.random() - 0.5) * 200;
      node.y ||= height / 2 + (Math.random() - 0.5) * 200;
    }

    node.id = id;

    // Honor pinned state across renders by fixing position
    if (node.data.pinned) {
      node.fx = node.x;
      node.fy = node.y;
    }
  });

  // 5) Create the simulation (forces are the core behavior for layout)
  const simulation = d3
    .forceSimulation(nodes)
    .force("link", d3.forceLink(links).distance(opts.linkDistance).strength(opts.linkStrength))
    .force("charge", d3.forceManyBody().strength(opts.charge))
    .force("center", d3.forceCenter(width / 2, height / 2).strength(opts.centerStrength))
    .force("collision", boxCollide(opts.margin))
    .force("x", d3.forceX(width / 2).strength(opts.xStrength))
    .force("y", d3.forceY(height / 2).strength(opts.yStrength))
    .alphaDecay(opts.alphaDecay)
    .velocityDecay(opts.velocityDecay);

  // 6) JOIN + ENTER + UPDATE for links
  const link = svg
    .selectAll("path.link")
    .data(links, (l) => `${l.source.id || l.source.index}-${l.target.id || l.target.index}`);

  link.exit().transition().duration(500).style("opacity", 0).remove();

  const linkEnter = link.enter().append("path").attr("class", "link").style("opacity", 0);

  const linkMerge = linkEnter.merge(link);
  linkEnter.transition().duration(500).style("opacity", 0.6);

  // 7) JOIN + ENTER + UPDATE for nodes
  const node = container.selectAll(".node").data(nodes, (n) => n.id);
  node.exit().transition().duration(500).style("opacity", 0).remove();

  const nodeEnter = node
    .enter()
    .append("div")
    .attr("class", "node")
    .attr("id", (n) => n.id)
    .style("opacity", 0)
    .style("left", (n) => `${n.x}px`)
    .style("top", (n) => `${n.y}px`)
    .call(d3.drag().on("start", dragstarted).on("drag", dragged).on("end", dragended));

  // Node content
  nodeEnter
    .append("div")
    .attr("class", "node-text")
    .text((n) => n.data.text);

  // Double-click releases pinning (explicit UX for discoverability)
  nodeEnter.on("dblclick", (event, n) => {
    event.stopPropagation();
    n.data.pinned = false;
    n.fx = null;
    n.fy = null;
    simulation.alpha(0.4).restart();
  });

  nodeEnter.transition().duration(500).style("opacity", 1);

  const nodeMerge = nodeEnter.merge(node);

  // Keep classes and text up-to-date on all nodes
  nodeMerge
    .classed("root", (n) => n.depth === 0)
    .classed("depth-1", (n) => n.depth === 1)
    .classed("depth-2", (n) => n.depth === 2)
    .classed("depth-3", (n) => n.depth >= 3)
    .classed("collapsed", (n) => isCollapsed(n))
    .classed("pinned", (n) => n.data.pinned);
  nodeMerge.select(".node-text").text((n) => n.data.text);

  // 8) Per-node collapse toggle (present only when a node can toggle)
  const toggle = nodeMerge.selectAll(".node-toggle").data(
    (n) => (hasChildren(n) || isCollapsed(n) ? [n] : []),
    (n) => n.id,
  );

  toggle.exit().remove();

  const toggleEnter = toggle
    .enter()
    .append("div")
    .attr("class", "node-toggle")
    // Prevent toggle mousedown from initiating a drag
    .on("mousedown", (e) => e.stopPropagation())
    .on("click", (e, n) => {
      e.stopPropagation();
      if (n.data.children) collapse(n.data);
      else expandOne(n.data);
      // Re-render with the same configuration so tuning persists
      mindgen(root.data, opts);
    });

  toggleEnter.merge(toggle).text((n) => (isCollapsed(n) ? "+" : "–"));

  // 9) Simulation ticks: clamp to bounds and redraw links
  const ticked = () => {
    nodeMerge.each(function positionNode(n) {
      const rect = this.getBoundingClientRect();
      const halfW = rect.width / 2;
      const halfH = rect.height / 2;
      const pad = opts.boundsPadding;

      // Clamp to container bounds to keep layout tidy
      n.x = Math.max(halfW + pad, Math.min(width - halfW - pad, n.x));
      n.y = Math.max(halfH + pad, Math.min(height - halfH - pad, n.y));

      d3.select(this)
        .style("left", `${n.x - halfW}px`)
        .style("top", `${n.y - halfH}px`);
    });

    linkMerge.attr("d", (l) => `M${l.source.x},${l.source.y} L${l.target.x},${l.target.y}`);
  };
  simulation.on("tick", ticked);

  // 10) Start the simulation with a bit of energy for smooth settling
  simulation.alpha(0.8).restart();

  // Helpers
  function dragstarted(event, n) {
    if (!event.active) simulation.alphaTarget(0.3).restart();
    n.fx = n.x;
    n.fy = n.y;
  }

  function dragged(event, n) {
    n.fx = event.x;
    n.fy = event.y;
  }

  function dragended(event, n) {
    if (!event.active) simulation.alphaTarget(0);
    // Any drag pins the node at its final location.
    n.data.pinned = true;
    n.fx = n.x;
    n.fy = n.y;
  }

  function hasChildren(n) {
    return Boolean(n.data.children && n.data.children.length);
  }

  function isCollapsed(n) {
    return Boolean(!n.data.children && n.data._children && n.data._children.length);
  }

  // Collapsing moves children to `_children` to preserve them in data.
  function collapse(d) {
    if (!d.children) return;
    d._children = d.children;
    d.children = undefined;
  }

  // Expanding one level reveals only direct children; deeper levels remain collapsed.
  function expandOne(d) {
    if (!d._children) return;
    d.children = d._children;
    d._children = undefined;
    d.children.forEach((child) => {
      if (child.children) {
        child._children = child.children;
        child.children = undefined;
      }
    });
  }

  // Collision force with box-aware separation based on measured DOM sizes.
  function boxCollide(padding) {
    /** @type {d3.SimulationNodeDatum[]} */
    let simNodes;
    const measured = new Map(); // id -> { w, h }

    function measure(node) {
      if (measured.has(node.id)) return;
      const el = document.getElementById(node.id);
      if (!el) return;
      const rect = el.getBoundingClientRect();
      measured.set(node.id, { w: rect.width, h: rect.height });
    }

    function force(alpha) {
      simNodes.forEach(measure);
      for (let i = 0; i < simNodes.length; i++) {
        for (let j = i + 1; j < simNodes.length; j++) {
          const a = simNodes[i];
          const b = simNodes[j];
          const A = measured.get(a.id);
          const B = measured.get(b.id);
          if (!A || !B) continue;

          const dx = b.x - a.x || 0.001;
          const dy = b.y - a.y || 0.001;
          const minX = (A.w + B.w) / 2 + padding;
          const minY = (A.h + B.h) / 2 + padding;

          // Separate along the lesser overlap axis for a natural slide
          const overlapX = minX - Math.abs(dx);
          const overlapY = minY - Math.abs(dy);
          if (overlapX > 0 && overlapY > 0) {
            if (overlapX < overlapY) {
              const delta = overlapX * Math.sign(dx) * alpha;
              a.x -= delta / 2;
              b.x += delta / 2;
            } else {
              const delta = overlapY * Math.sign(dy) * alpha;
              a.y -= delta / 2;
              b.y += delta / 2;
            }
          }
        }
      }
    }

    force.initialize = (nodesArray) => {
      simNodes = nodesArray;
      measured.clear();
    };
    return force;
  }

  // Container dblclick: clear all pins when not double-clicking a node
  container.on("dblclick", (event) => {
    const isNode = event.target.closest && event.target.closest(".node");
    if (isNode) return;
    nodes.forEach((n) => {
      n.data.pinned = false;
      n.fx = null;
      n.fy = null;
    });
    simulation.alpha(0.4).restart();
  });
}
