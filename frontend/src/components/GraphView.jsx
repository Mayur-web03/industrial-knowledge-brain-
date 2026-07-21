import { useEffect, useRef, useState } from "react";
import * as d3 from "d3";
import { fetchGraph, fetchFlags, fetchCascade } from "../api";

const TYPE_COLORS = {
  EQUIPMENT: "#34C3D9",
  DOCUMENT: "#868D93",
  PROCEDURE: "#9C86D9",
  PERSONNEL: "#35B07A",
  OTHER: "#F0B429",
};

const CASCADE_STEP_MS = 550;

function resolveType(n) {
  const raw = n.type || n.node_type || n.category || n.label_type || n.kind || "";
  const upper = String(raw).toUpperCase().trim();
  return TYPE_COLORS[upper] ? upper : "OTHER";
}

function nodeColor(n) {
  return TYPE_COLORS[resolveType(n)];
}

function displayLabel(id) {
  return id.length > 16 ? id.slice(0, 14) + "…" : id;
}

function estimateLabelHalfWidth(id) {
  const shown = displayLabel(id);
  return (shown.length * 5.6) / 2;
}

export default function GraphView() {
  const [graph, setGraph] = useState(null);
  const [flaggedIds, setFlaggedIds] = useState(new Set());
  const [error, setError] = useState(null);
  const [layout, setLayout] = useState(null);
  const [hoveredNode, setHoveredNode] = useState(null);
  const [selectedNode, setSelectedNode] = useState(null);
  const svgRef = useRef(null);
  const zoomGroupRef = useRef(null);

  // --- Cascading Risk Simulator state ---
  const [cascadeData, setCascadeData] = useState(null);   // raw response from /cascade
  const [cascadeLoading, setCascadeLoading] = useState(false);
  const [cascadeError, setCascadeError] = useState(null);
  const [revealedDepth, setRevealedDepth] = useState(0);  // how many hops animated in so far
  const cascadeTimersRef = useRef([]);

  useEffect(() => {
    fetchGraph()
      .then(setGraph)
      .catch((e) => setError(e.message));

    fetchFlags()
      .then((data) => {
        const targetFlags = data.flags || data;
        const ids = new Set();
        if (Array.isArray(targetFlags)) {
          targetFlags.forEach((f) => {
            if (f.equipment) ids.add(f.equipment);
            if (f.related_incident) ids.add(f.related_incident);
          });
        }
        setFlaggedIds(ids);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!graph) return;

    const nodes = (graph.nodes || []).map((n) => ({ ...n }));
    const rawEdges = graph.links || graph.edges || [];
    const links = rawEdges.map((e) => ({
      source: e.source,
      target: e.target,
      relation: e.relation || e.type,
    }));

    const simWidth = 1200;
    const simHeight = 1200;

    const simulation = d3
      .forceSimulation(nodes)
      .force("link", d3.forceLink(links).id((d) => d.id).distance(115).strength(0.5))
      .force("charge", d3.forceManyBody().strength(-320))
      .force("center", d3.forceCenter(simWidth / 2, simHeight / 2))
      .force("collide", d3.forceCollide(52))
      .stop();

    for (let i = 0; i < 400; i++) simulation.tick();

    const pad = 40;
    const NODE_MAX_RADIUS = 22;
    const LABEL_Y_OFFSET = 28;
    const LABEL_HEIGHT = 14;

    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;

    nodes.forEach((n) => {
      const halfLabel = estimateLabelHalfWidth(n.id);
      const left = n.x - Math.max(NODE_MAX_RADIUS, halfLabel);
      const right = n.x + Math.max(NODE_MAX_RADIUS, halfLabel);
      const top = n.y - NODE_MAX_RADIUS;
      const bottom = n.y + LABEL_Y_OFFSET + LABEL_HEIGHT;

      if (left < minX) minX = left;
      if (right > maxX) maxX = right;
      if (top < minY) minY = top;
      if (bottom > maxY) maxY = bottom;
    });

    minX -= pad; maxX += pad; minY -= pad; maxY += pad;

    setLayout({
      nodes,
      links,
      viewBox: `${minX} ${minY} ${maxX - minX} ${maxY - minY}`,
    });
  }, [graph]);

  useEffect(() => {
    if (!layout || !svgRef.current || !zoomGroupRef.current) return;

    const svg = d3.select(svgRef.current);
    const group = d3.select(zoomGroupRef.current);

    const zoom = d3.zoom()
      .scaleExtent([0.3, 4])
      .on("zoom", (event) => {
        group.attr("transform", event.transform);
      });

    svg.call(zoom);

    return () => svg.on(".zoom", null);
  }, [layout]);

  // Clean up any pending reveal timers on unmount
  useEffect(() => {
    return () => cascadeTimersRef.current.forEach(clearTimeout);
  }, []);

  function clearCascadeTimers() {
    cascadeTimersRef.current.forEach(clearTimeout);
    cascadeTimersRef.current = [];
  }

  function runCascadeSimulation(nodeId) {
    clearCascadeTimers();
    setCascadeError(null);
    setCascadeData(null);
    setRevealedDepth(0);
    setCascadeLoading(true);

    fetchCascade(nodeId, 2)
      .then((data) => {
        setCascadeLoading(false);
        if (!data.found || data.levels.length === 0) {
          setCascadeData(data);
          setRevealedDepth(0);
          return;
        }
        setCascadeData(data);
        // reveal one hop at a time so the traversal is visibly "animated"
        data.levels.forEach((_, i) => {
          const timer = setTimeout(() => {
            setRevealedDepth(i + 1);
          }, (i + 1) * CASCADE_STEP_MS);
          cascadeTimersRef.current.push(timer);
        });
      })
      .catch((e) => {
        setCascadeLoading(false);
        setCascadeError(e.message);
      });
  }

  function clearCascade() {
    clearCascadeTimers();
    setCascadeData(null);
    setCascadeError(null);
    setRevealedDepth(0);
  }

  function handleSelectNode(id) {
    if (selectedNode === id) {
      setSelectedNode(null);
      clearCascade();
    } else {
      setSelectedNode(id);
      clearCascade();
    }
  }

  if (error) {
    return (
      <div className="view graph-view">
        <div className="view-header"><h2>Knowledge Graph</h2></div>
        <div className="graph-error">Couldn't load graph data clusters: {error}</div>
      </div>
    );
  }

  if (!graph || !layout) {
    return (
      <div className="view graph-view">
        <div className="view-header"><h2>Knowledge Graph</h2></div>
        <p className="view-subtitle">Analyzing and rendering clusters…</p>
      </div>
    );
  }

  const { nodes, links, viewBox } = layout;
  const nodeById = new Map(nodes.map((n) => [n.id, n]));

  const connectedToSelected = new Set();
  if (selectedNode) {
    connectedToSelected.add(selectedNode);
    links.forEach((l) => {
      const s = typeof l.source === "object" ? l.source.id : l.source;
      const t = typeof l.target === "object" ? l.target.id : l.target;
      if (s === selectedNode) connectedToSelected.add(t);
      if (t === selectedNode) connectedToSelected.add(s);
    });
  }

  // --- Nodes/edges revealed so far in the cascade animation ---
  const cascadeNodeIds = new Set();
  const cascadeEdgeReasons = new Map(); // "from|to" -> reason
  if (cascadeData && cascadeData.found) {
    cascadeNodeIds.add(cascadeData.root);
    for (let d = 0; d < revealedDepth; d++) {
      (cascadeData.levels[d] || []).forEach((id) => cascadeNodeIds.add(id));
    }
    cascadeData.explanation
      .filter((e) => e.depth <= revealedDepth)
      .forEach((e) => {
        cascadeEdgeReasons.set(`${e.from}|${e.to}`, e.reason);
        cascadeEdgeReasons.set(`${e.to}|${e.from}`, e.reason);
      });
  }
  const cascadeActive = !!cascadeData && cascadeData.found;

  const selected = selectedNode ? nodeById.get(selectedNode) : null;

  return (
    <div className="view graph-view">
      <div className="view-header">
        <h2>Knowledge Graph</h2>
        <p className="view-subtitle">
          {nodes.length} nodes · {links.length} connections — click a node, then run the cascade simulator
        </p>
      </div>

      <div className="graph-legend">
        {Object.entries(TYPE_COLORS).map(([type, color]) => (
          <span className="legend-item" key={type}>
            <span className="legend-dot" style={{ background: color }} />
            {type}
          </span>
        ))}
        <span className="legend-item">
          <span className="legend-dot legend-dot-flag" />
          FLAGGED RISK
        </span>
        <span className="legend-item">
          <span className="legend-dot legend-dot-cascade" />
          CASCADE PATH
        </span>
      </div>

      {/* graph-body wraps canvas + side panel so they sit side-by-side
          instead of stacking vertically — keeps the graph visible while
          the (potentially long) cascade result scrolls independently. */}
      <div className="graph-body">
        <div className="graph-canvas-wrap">
          <svg ref={svgRef} viewBox={viewBox} className="graph-svg">
            <g ref={zoomGroupRef}>
              <g>
                {links.map((l, i) => {
                  const s = typeof l.source === "object" ? l.source : nodeById.get(l.source);
                  const t = typeof l.target === "object" ? l.target : nodeById.get(l.target);
                  if (!s || !t) return null;

                  const inCascade = cascadeActive && cascadeNodeIds.has(s.id) && cascadeNodeIds.has(t.id);
                  const dimmed = selectedNode && !cascadeActive &&
                    !(connectedToSelected.has(s.id) && connectedToSelected.has(t.id));
                  const cascadeDimmed = cascadeActive && !inCascade;

                  return (
                    <line
                      key={i}
                      x1={s.x} y1={s.y} x2={t.x} y2={t.y}
                      className={`graph-edge ${dimmed ? "dimmed" : ""} ${cascadeDimmed ? "dimmed" : ""} ${inCascade ? "cascade-edge" : ""}`}
                    />
                  );
                })}
              </g>

              <g>
                {nodes.map((n) => {
                  const isFlagged = flaggedIds.has(n.id);
                  const isHovered = hoveredNode === n.id;
                  const inCascade = cascadeActive && cascadeNodeIds.has(n.id);
                  const isCascadeRoot = cascadeActive && cascadeData.root === n.id;
                  const dimmed = selectedNode && !cascadeActive && !connectedToSelected.has(n.id);
                  const cascadeDimmed = cascadeActive && !inCascade;

                  return (
                    <g
                      key={n.id}
                      transform={`translate(${n.x},${n.y})`}
                      onMouseEnter={() => setHoveredNode(n.id)}
                      onMouseLeave={() => setHoveredNode(null)}
                      onClick={() => handleSelectNode(n.id)}
                      className={`graph-node-group ${dimmed ? "dimmed" : ""} ${cascadeDimmed ? "dimmed" : ""}`}
                    >
                      <title>{n.id}</title>

                      {isFlagged && <circle r={20} className="node-flag-ring" />}
                      {inCascade && !isCascadeRoot && <circle r={19} className="node-cascade-ring" />}
                      {isCascadeRoot && <circle r={22} className="node-cascade-root-ring" />}

                      <circle
                        r={14}
                        fill={nodeColor(n)}
                        className={`graph-node-circle ${isHovered ? "hovered" : ""}`}
                      />
                      <text y={28} textAnchor="middle" className="graph-node-label">
                        {displayLabel(n.id)}
                      </text>
                    </g>
                  );
                })}
              </g>
            </g>
          </svg>
        </div>

        {selected && (
          <div className="graph-detail-panel">
            <div className="graph-detail-title">{selected.id}</div>
            <div className="graph-detail-type" style={{ color: nodeColor(selected) }}>
              {resolveType(selected)}
            </div>
            {flaggedIds.has(selected.id) && (
              <div className="graph-detail-flag">⚠ Part of an active risk flag</div>
            )}

            {!cascadeActive && !cascadeLoading && (
              <button
                className="cascade-run-btn"
                onClick={() => runCascadeSimulation(selected.id)}
              >
                ▶ Run Cascade Risk Simulation
              </button>
            )}

            {cascadeLoading && (
              <div className="cascade-loading">Tracing dependency graph…</div>
            )}

            {cascadeError && (
              <div className="graph-detail-flag">Cascade failed: {cascadeError}</div>
            )}

            {cascadeActive && (
              <div className="cascade-panel">
                <div className="cascade-panel-title">
                  Cascading Risk Analysis
                  {cascadeData.total_affected > 0 && (
                    <span className="cascade-count">{cascadeData.total_affected} affected</span>
                  )}
                </div>
                <p className="cascade-summary">
                  If <strong>{cascadeData.root}</strong> fails, based on shared maintenance
                  history, incidents, and procedure references, the following are affected:
                </p>

                {cascadeData.levels.length === 0 && (
                  <p className="cascade-empty">No connected entities found for this node.</p>
                )}

                {cascadeData.levels.map((levelIds, depthIdx) => {
                  const depth = depthIdx + 1;
                  if (depth > revealedDepth) return null;
                  return (
                    <div className="cascade-level" key={depth}>
                      <div className="cascade-level-label">Hop {depth}</div>
                      {levelIds.map((id) => {
                        const entry = cascadeData.explanation.find(
                          (e) => e.to === id && e.depth === depth
                        );
                        return (
                          <div className="cascade-item" key={id}>
                            <span className="cascade-item-name">{id}</span>
                            <span className="cascade-item-reason">
                              {entry ? entry.reason : ""}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}

                <button className="cascade-run-btn cascade-reset-btn" onClick={clearCascade}>
                  Reset simulation
                </button>
              </div>
            )}

            <button className="graph-detail-close" onClick={() => handleSelectNode(selectedNode)}>
              Clear selection
            </button>
          </div>
        )}
      </div>
    </div>
  );
}