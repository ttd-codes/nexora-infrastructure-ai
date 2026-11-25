import { useMemo, useState } from 'react';
import {
  Background,
  Controls,
  Edge,
  Handle,
  MiniMap,
  Node,
  NodeProps,
  Position,
  ReactFlow,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Search, X } from 'lucide-react';
import { useWorkspace } from '../context/WorkspaceContext';

type GraphEntityKind =
  | 'location'
  | 'asset'
  | 'component'
  | 'record'
  | 'repair'
  | 'document'
  | 'recommendation';

interface GraphNodeData extends Record<string, unknown> {
  kind: GraphEntityKind;
  code: string;
  label: string;
  subtitle: string;
  meta: Record<string, string>;
  assetId?: string;
  recommendationId?: string;
  highlighted?: boolean;
}

const KIND_STYLES: Record<GraphEntityKind, { border: string; tag: string; tagColor: string }> = {
  location: { border: 'border-white/20', tag: 'LOCATION', tagColor: 'text-[#9AA5B1]' },
  asset: { border: 'border-[#F5B942]/70', tag: 'ASSET', tagColor: 'text-[#F5B942]' },
  component: { border: 'border-[#55C6D9]/60', tag: 'COMPONENT', tagColor: 'text-[#55C6D9]' },
  record: { border: 'border-[#F5B942]/50', tag: 'EVENT', tagColor: 'text-[#F5B942]' },
  repair: { border: 'border-[#3DD68C]/50', tag: 'REPAIR ACTION', tagColor: 'text-[#3DD68C]' },
  document: { border: 'border-white/25', tag: 'SOURCE DOC', tagColor: 'text-[#9AA5B1]' },
  recommendation: { border: 'border-[#E05252]/70', tag: 'RECOMMENDATION', tagColor: 'text-[#E05252]' },
};

function MemoryNode({ data, selected }: NodeProps<Node<GraphNodeData>>) {
  const style = KIND_STYLES[data.kind];
  return (
    <div
      className={`min-w-[205px] max-w-[240px] bg-[#1B2229] border rounded-md px-3 py-2.5 transition-colors ${
        selected || data.highlighted
          ? 'border-[#F5B942] ring-1 ring-[#F5B942]/50'
          : style.border
      }`}
    >
      <Handle type="target" position={Position.Left} className="!bg-[#55C6D9] !w-2 !h-2" />
      <div className="flex items-center justify-between gap-2 text-[10px] font-mono tracking-wide">
        <span className={style.tagColor}>{style.tag}</span>
        <span className="text-[#9AA5B1] tabular-nums">{data.code}</span>
      </div>
      <div className="text-xs font-semibold text-[#F4F5F6] mt-1 leading-snug line-clamp-2">
        {data.label}
      </div>
      <div className="text-[11px] text-[#9AA5B1] mt-0.5 truncate">{data.subtitle}</div>
      <Handle type="source" position={Position.Right} className="!bg-[#F5B942] !w-2 !h-2" />
    </div>
  );
}

const nodeTypes = {
  memoryNode: MemoryNode,
};

export function MemoryGraph() {
  const {
    assets,
    locations,
    records,
    documents,
    recommendations,
    openAssetDetail,
    openInvestigation,
  } = useWorkspace();

  const [focusAssetId, setFocusAssetId] = useState<string>(() => {
    const p104 = assets.find((a) => a.assetCode === 'P-104');
    return p104 ? p104.id : 'ALL';
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [showDocs, setShowDocs] = useState(true);
  const [showRepairs, setShowRepairs] = useState(true);
  const [selectedNodeData, setSelectedNodeData] = useState<GraphNodeData | null>(null);

  const { nodes, edges } = useMemo(() => {
    const builtNodes: Node<GraphNodeData>[] = [];
    const builtEdges: Edge[] = [];
    const addedIds = new Set<string>();
    const q = searchTerm.trim().toLowerCase();

    const activeAssets =
      focusAssetId === 'ALL'
        ? assets
        : assets.filter((a) => a.id === focusAssetId);

    const addNode = (id: string, x: number, y: number, data: GraphNodeData) => {
      if (addedIds.has(id)) return;
      addedIds.add(id);
      const isMatch =
        q.length > 0 &&
        (data.label.toLowerCase().includes(q) ||
          data.code.toLowerCase().includes(q) ||
          data.subtitle.toLowerCase().includes(q));
      builtNodes.push({
        id,
        type: 'memoryNode',
        position: { x, y },
        data: { ...data, highlighted: isMatch },
      });
    };

    let yCursor = 40;

    for (const asset of activeAssets) {
      const loc = locations.find((l) => l.id === asset.locationId);
      const assetRecords = records
        .filter((r) => r.assetId === asset.id)
        .sort((a, b) => a.incidentDate.localeCompare(b.incidentDate));
      const assetRecs = recommendations.filter((rec) => rec.assetId === asset.id);
      const assetDocs = documents.filter((d) => d.assetId === asset.id);

      const blockStartY = yCursor;

      // Column 1: Location
      if (loc) {
        const locNodeId = `loc_${loc.id}`;
        addNode(locNodeId, 20, blockStartY, {
          kind: 'location',
          code: loc.buildingCode,
          label: loc.name.split('—')[0].trim(),
          subtitle: loc.facilityType || 'Campus Facility',
          meta: {
            'Building Code': loc.buildingCode,
            'Facility Type': loc.facilityType || 'Campus Zone',
            Description: loc.zoneDescription || '—',
          },
        });
        builtEdges.push({
          id: `e_${locNodeId}_${asset.id}`,
          source: locNodeId,
          target: `asset_${asset.id}`,
          label: 'houses',
          animated: true,
          style: { stroke: '#55C6D9', strokeWidth: 1.5 },
          labelStyle: { fill: '#9AA5B1', fontSize: 10 },
          labelBgStyle: { fill: '#101418' },
        });
      }

      // Column 2: Asset
      const assetNodeId = `asset_${asset.id}`;
      addNode(assetNodeId, 300, blockStartY, {
        kind: 'asset',
        code: asset.assetCode,
        label: asset.name,
        subtitle: `${asset.category} · ${asset.status}`,
        assetId: asset.id,
        meta: {
          'Asset ID': asset.assetCode,
          Status: asset.status,
          Manufacturer: asset.manufacturer || '—',
          Model: asset.modelNumber || '—',
          Location: asset.locationName,
        },
      });

      // Column 3: Involved Components (derived from records or first asset component)
      const involvedComponents = Array.from(
        new Set(
          assetRecords
            .map((r) => r.componentInvolved?.trim())
            .filter((c): c is string => Boolean(c))
        )
      );
      if (involvedComponents.length === 0 && asset.components.length > 0) {
        involvedComponents.push(asset.components[0]);
      }

      involvedComponents.forEach((compName, idx) => {
        const compId = `comp_${asset.id}_${compName.replace(/[^a-zA-Z0-9]/g, '_')}`;
        addNode(compId, 580, blockStartY + idx * 105, {
          kind: 'component',
          code: asset.assetCode,
          label: compName,
          subtitle: 'Tracked Subsystem',
          assetId: asset.id,
          meta: {
            Component: compName,
            Asset: `${asset.assetCode} — ${asset.name}`,
          },
        });
        builtEdges.push({
          id: `e_${assetNodeId}_${compId}`,
          source: assetNodeId,
          target: compId,
          label: 'contains',
          animated: true,
          style: { stroke: '#55C6D9', strokeWidth: 1.5 },
          labelStyle: { fill: '#9AA5B1', fontSize: 10 },
          labelBgStyle: { fill: '#101418' },
        });
      });

      // Column 4 & 5: Chronological Records & Repair Actions
      let previousEventNodeId: string | null = null;
      assetRecords.forEach((rec, idx) => {
        const recY = blockStartY + idx * 125;
        const recNodeId = `rec_${rec.id}`;
        addNode(recNodeId, 860, recY, {
          kind: 'record',
          code: rec.recordCode,
          label: rec.title,
          subtitle: `${rec.incidentDate} · ${rec.recordType}`,
          assetId: asset.id,
          meta: {
            'Record Code': rec.recordCode,
            Date: rec.incidentDate,
            Type: rec.recordType,
            Status: rec.status,
            Technician: rec.technicianName || 'Unattributed',
            Description: rec.description,
            Source: rec.sourceDocumentName || 'Direct Entry',
          },
        });

        const compTarget = rec.componentInvolved
          ? `comp_${asset.id}_${rec.componentInvolved.replace(/[^a-zA-Z0-9]/g, '_')}`
          : assetNodeId;
        const sourceId = addedIds.has(compTarget) ? compTarget : assetNodeId;

        builtEdges.push({
          id: `e_${sourceId}_${recNodeId}`,
          source: sourceId,
          target: recNodeId,
          label: rec.recordType.toLowerCase(),
          animated: true,
          style: { stroke: '#F5B942', strokeWidth: 1.5 },
          labelStyle: { fill: '#9AA5B1', fontSize: 10 },
          labelBgStyle: { fill: '#101418' },
        });

        if (previousEventNodeId) {
          builtEdges.push({
            id: `e_seq_${previousEventNodeId}_${recNodeId}`,
            source: previousEventNodeId,
            target: recNodeId,
            label: 'followed by',
            animated: true,
            style: { stroke: '#F5B942', strokeDasharray: '4 4', strokeWidth: 1.2 },
            labelStyle: { fill: '#F5B942', fontSize: 10 },
            labelBgStyle: { fill: '#101418' },
          });
        }
        previousEventNodeId = recNodeId;

        if (showRepairs && rec.repairAction) {
          const repairNodeId = `rep_${rec.id}`;
          addNode(repairNodeId, 1140, recY, {
            kind: 'repair',
            code: rec.recordCode,
            label: rec.repairAction,
            subtitle: `By ${rec.technicianName || 'Technician'}`,
            assetId: asset.id,
            meta: {
              'Repair Action': rec.repairAction,
              Date: rec.incidentDate,
              Technician: rec.technicianName || 'Unattributed',
              Status: rec.status,
            },
          });
          builtEdges.push({
            id: `e_${recNodeId}_${repairNodeId}`,
            source: recNodeId,
            target: repairNodeId,
            label: 'addressed via',
            animated: true,
            style: { stroke: '#3DD68C', strokeWidth: 1.5 },
            labelStyle: { fill: '#9AA5B1', fontSize: 10 },
            labelBgStyle: { fill: '#101418' },
          });
        }
      });

      // Source Documents
      if (showDocs) {
        assetDocs.forEach((d, idx) => {
          const docNodeId = `doc_${d.id}`;
          addNode(docNodeId, 580, blockStartY + Math.max(involvedComponents.length, 1) * 115 + idx * 100, {
            kind: 'document',
            code: d.fileType.toUpperCase(),
            label: d.fileName,
            subtitle: d.extractionStatus,
            assetId: asset.id,
            meta: {
              Filename: d.fileName,
              Type: d.fileType,
              Status: d.extractionStatus,
              Summary: d.extractedSummary || '—',
            },
          });
          builtEdges.push({
            id: `e_${docNodeId}_${assetNodeId}`,
            source: docNodeId,
            target: assetNodeId,
            label: 'evidences',
            animated: true,
            style: { stroke: '#9AA5B1', strokeWidth: 1.2 },
            labelStyle: { fill: '#9AA5B1', fontSize: 10 },
            labelBgStyle: { fill: '#101418' },
          });
        });
      }

      // Column 6: AI Recommendations
      assetRecs.forEach((reco, idx) => {
        const recoNodeId = `reco_${reco.id}`;
        addNode(recoNodeId, 1430, blockStartY + idx * 130, {
          kind: 'recommendation',
          code: reco.severity.toUpperCase(),
          label: reco.title,
          subtitle: `${reco.supportingRecordIds.length} linked records · ${reco.evidenceCompleteness}%`,
          assetId: asset.id,
          recommendationId: reco.id,
          meta: {
            Rule: reco.ruleTriggered,
            Severity: reco.severity,
            Status: reco.status,
            Interpretation: reco.interpretation,
            'Evidence Completeness': `${reco.evidenceCompleteness}%`,
          },
        });
        for (const recId of reco.supportingRecordIds) {
          const targetSource = showRepairs && addedIds.has(`rep_${recId}`) ? `rep_${recId}` : `rec_${recId}`;
          if (addedIds.has(targetSource)) {
            builtEdges.push({
              id: `e_${targetSource}_${recoNodeId}`,
              source: targetSource,
              target: recoNodeId,
              label: 'supports',
              animated: true,
              style: { stroke: '#E05252', strokeWidth: 1.5 },
              labelStyle: { fill: '#9AA5B1', fontSize: 10 },
              labelBgStyle: { fill: '#101418' },
            });
          }
        }
      });

      const rowsUsed = Math.max(
        assetRecords.length,
        involvedComponents.length + (showDocs ? assetDocs.length : 0),
        assetRecs.length,
        1
      );
      yCursor += rowsUsed * 135 + 60;
    }

    return { nodes: builtNodes, edges: builtEdges };
  }, [assets, locations, records, documents, recommendations, focusAssetId, searchTerm, showDocs, showRepairs]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-[#F4F5F6] tracking-tight">
            Infrastructure Memory Graph
          </h1>
          <p className="text-sm text-[#9AA5B1] mt-1">
            Database-backed knowledge graph tracing locations, assets, components, events, repairs, source documents, and pattern recommendations.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-2 bg-[#1B2229] border border-white/10 rounded-md px-3 py-1.5 text-xs">
            <Search className="w-3.5 h-3.5 text-[#9AA5B1]" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Highlight nodes..."
              className="bg-transparent text-[#F4F5F6] placeholder-[#9AA5B1]/60 focus:outline-none w-36"
            />
          </div>

          <select
            aria-label="Focus graph on asset"
            value={focusAssetId}
            onChange={(e) => setFocusAssetId(e.target.value)}
            className="bg-[#1B2229] border border-white/10 rounded-md px-3 py-1.5 text-xs text-[#F4F5F6] focus:outline-none"
          >
            <option value="ALL">Full Campus Graph ({assets.length} Assets)</option>
            {assets.map((a) => (
              <option key={a.id} value={a.id}>
                Focus: {a.assetCode} — {a.name}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => setShowRepairs((v) => !v)}
            className={`px-3 py-1.5 text-xs rounded-md border transition-colors ${
              showRepairs
                ? 'bg-[#242C34] border-[#3DD68C]/50 text-[#F4F5F6]'
                : 'bg-[#1B2229] border-white/10 text-[#9AA5B1]'
            }`}
          >
            Repairs
          </button>
          <button
            type="button"
            onClick={() => setShowDocs((v) => !v)}
            className={`px-3 py-1.5 text-xs rounded-md border transition-colors ${
              showDocs
                ? 'bg-[#242C34] border-[#55C6D9]/50 text-[#F4F5F6]'
                : 'bg-[#1B2229] border-white/10 text-[#9AA5B1]'
            }`}
          >
            Documents
          </button>
        </div>
      </div>

      {/* Graph Canvas + Evidence Inspector */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div
          className={`${
            selectedNodeData ? 'lg:col-span-8' : 'lg:col-span-12'
          } h-[620px] bg-[#101418] border border-white/10 rounded-lg overflow-hidden`}
        >
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            onNodeClick={(_event, node) => setSelectedNodeData(node.data)}
            fitView
            minZoom={0.25}
            maxZoom={1.6}
          >
            <Background color="#242C34" gap={20} size={1} />
            <Controls />
            <MiniMap
              nodeColor={(n) => {
                const kind = (n.data as GraphNodeData)?.kind;
                if (kind === 'asset') return '#F5B942';
                if (kind === 'recommendation') return '#E05252';
                if (kind === 'repair') return '#3DD68C';
                return '#55C6D9';
              }}
              maskColor="rgba(16, 20, 24, 0.75)"
            />
          </ReactFlow>
        </div>

        {selectedNodeData && (
          <div className="lg:col-span-4 bg-[#1B2229] border border-white/10 rounded-lg p-5 flex flex-col justify-between h-[620px] overflow-y-auto">
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-mono text-xs text-[#F5B942] uppercase">
                    {selectedNodeData.kind} · {selectedNodeData.code}
                  </div>
                  <h2 className="text-base font-semibold text-[#F4F5F6] mt-1">
                    {selectedNodeData.label}
                  </h2>
                  <p className="text-xs text-[#9AA5B1] mt-0.5">{selectedNodeData.subtitle}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedNodeData(null)}
                  className="text-[#9AA5B1] hover:text-[#F4F5F6] p-1"
                  aria-label="Close inspector"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="border-t border-white/10 pt-3 space-y-3">
                {Object.entries(selectedNodeData.meta).map(([k, v]) => (
                  <div key={k} className="space-y-0.5">
                    <div className="text-[11px] font-medium text-[#9AA5B1]">{k}</div>
                    <div className="text-xs text-[#F4F5F6] leading-relaxed break-words">{v}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-4 border-t border-white/10 flex flex-wrap gap-2">
              {selectedNodeData.assetId && (
                <button
                  type="button"
                  onClick={() => openAssetDetail(selectedNodeData.assetId!)}
                  className="px-3 py-2 text-xs font-medium bg-[#242C34] hover:bg-[#2d3741] text-[#F4F5F6] rounded-md transition-colors"
                >
                  Open Asset Profile
                </button>
              )}
              {selectedNodeData.recommendationId && (
                <button
                  type="button"
                  onClick={() => openInvestigation(selectedNodeData.recommendationId!)}
                  className="px-3 py-2 text-xs font-medium bg-[#F5B942] text-[#101418] rounded-md hover:bg-[#f6c45f] transition-colors"
                >
                  Investigate Evidence
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
