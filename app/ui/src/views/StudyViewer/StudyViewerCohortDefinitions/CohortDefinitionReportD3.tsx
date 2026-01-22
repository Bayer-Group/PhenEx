import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { getHierarchicalBackgroundColor } from '@/views/CohortViewer/CohortTable/CellRenderers/PhenexCellRenderer';

interface CohortDefinitionReportD3Props {
  rows: any[];
  cohortId: string;
  onRowClick?: (row: any, index: number) => void;
}

export const CohortDefinitionReportD3: React.FC<CohortDefinitionReportD3Props> = ({
  rows,
  cohortId,
  onRowClick,
}) => {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current || !rows || rows.length === 0) return;

    // Clear previous render
    d3.select(svgRef.current).selectAll('*').remove();

    // Constants
    const LEFT_WRAPPER_WIDTH = 240;
    const BOX_CENTER_X = LEFT_WRAPPER_WIDTH / 2;
    const ROW_HEIGHT = 80;
    const ARROW_HEIGHT = 40;
    const EXCLUDED_BOX_WIDTH = 80;
    const EXCLUDED_BOX_OFFSET = 260;
    
    // Prepare data: synthetic first row + actual rows + synthetic last row
    const allRows = [
      { 
        name: 'Total Database Size', 
        count: rows[0]?.count, 
        effective_type: 'database', 
        hierarchical_index: 0,
        hideExclusion: true,
        isSynthetic: true
      },
      ...rows.map(r => ({ ...r, hideExclusion: false, isSynthetic: false })),
      { 
        name: 'Final Cohort Size', 
        count: rows[rows.length - 1]?.count, 
        effective_type: 'cohort', 
        hierarchical_index: 0,
        hideExclusion: true,
        isSynthetic: true
      }
    ];

    // Calculate total height
    const totalHeight = allRows.length * ROW_HEIGHT + (allRows.length - 1) * ARROW_HEIGHT + 40;
    const totalWidth = LEFT_WRAPPER_WIDTH + EXCLUDED_BOX_OFFSET + EXCLUDED_BOX_WIDTH + 40;

    const svg = d3.select(svgRef.current)
      .attr('width', totalWidth)
      .attr('height', totalHeight)
      .attr('viewBox', `0 0 ${totalWidth} ${totalHeight}`);

    // Define arrow marker
    svg.append('defs')
      .append('marker')
      .attr('id', 'reportArrowhead')
      .attr('markerWidth', 16)
      .attr('markerHeight', 16)
      .attr('refX', 7)
      .attr('refY', 7)
      .attr('orient', 'auto')
      .attr('markerUnits', 'userSpaceOnUse')
      .append('polyline')
      .attr('points', '1 1, 7 7, 1 13')
      .attr('fill', 'none')
      .attr('stroke', 'currentColor')
      .attr('stroke-width', 1)
      .attr('stroke-linecap', 'round')
      .attr('stroke-linejoin', 'round');

    // Create main group
    const mainGroup = svg.append('g')
      .attr('transform', 'translate(20, 20)');

    // Draw vertical arrows
    const verticalArrows = mainGroup.selectAll('.vertical-arrow')
      .data(allRows.slice(0, -1))
      .enter()
      .append('g')
      .attr('class', 'vertical-arrow')
      .attr('transform', (d, i) => {
        const y = i * (ROW_HEIGHT + ARROW_HEIGHT) + ROW_HEIGHT;
        return `translate(${BOX_CENTER_X - 10}, ${y})`;
      });

    verticalArrows.append('line')
      .attr('x1', 10)
      .attr('y1', 0)
      .attr('x2', 10)
      .attr('y2', 35)
      .attr('stroke', (d: any) => {
        if (d.isSynthetic) return '#555';
        return d.effective_type ? `var(--color_${d.effective_type})` : '#555';
      })
      .attr('stroke-width', 1)
      .attr('marker-end', 'url(#reportArrowhead)');

    // Draw rows
    const rowGroups = mainGroup.selectAll('.row-group')
      .data(allRows)
      .enter()
      .append('g')
      .attr('class', 'row-group')
      .attr('transform', (d, i) => {
        const y = i * (ROW_HEIGHT + ARROW_HEIGHT);
        return `translate(0, ${y})`;
      });

    // Draw phenotype boxes
    rowGroups.each(function(d: any, i) {
      const group = d3.select(this);
      
      const backgroundColor = getHierarchicalBackgroundColor(d.effective_type, d.hierarchical_index);
      const borderColor = d.effective_type ? `var(--color_${d.effective_type}_dim)` : '#333';
      const textColor = d.effective_type ? `var(--color_${d.effective_type})` : '#333';

      // Compute box width based on content (simplified - could be more sophisticated)
      const nameLength = (d.name || 'Unnamed').length;
      const boxWidth = Math.min(Math.max(nameLength * 8, 100), 300);
      const boxX = BOX_CENTER_X - boxWidth / 2;

      // White background box
      const boxGroup = group.append('g')
        .attr('class', 'phenotype-box')
        .attr('transform', `translate(${boxX}, 0)`);

      boxGroup.append('rect')
        .attr('width', boxWidth)
        .attr('height', 60)
        .attr('rx', 8)
        .attr('ry', 8)
        .attr('fill', 'white')
        .attr('stroke', textColor)
        .attr('stroke-width', 1)
        .style('cursor', d.isSynthetic ? 'default' : 'pointer')
        .on('click', () => {
          if (!d.isSynthetic && onRowClick) {
            onRowClick(d, i - 1); // Adjust index for synthetic first row
          }
        });

      // Colored layer
      boxGroup.append('rect')
        .attr('width', boxWidth)
        .attr('height', 60)
        .attr('rx', 8)
        .attr('ry', 8)
        .attr('fill', backgroundColor || 'white')
        .attr('fill-opacity', 0.6)
        .style('pointer-events', 'none');

      // Text content using foreignObject for better formatting
      const foreignObject = boxGroup.append('foreignObject')
        .attr('width', boxWidth)
        .attr('height', 60)
        .style('pointer-events', 'none');

      const div = foreignObject.append('xhtml:div')
        .style('width', '100%')
        .style('height', '100%')
        .style('display', 'flex')
        .style('flex-direction', 'column')
        .style('justify-content', 'center')
        .style('padding', '8px 12px')
        .style('box-sizing', 'border-box')
        .style('color', textColor);

      // Name
      div.append('div')
        .style('font-size', '14px')
        .style('font-weight', '500')
        .style('margin-bottom', d.description ? '4px' : '0')
        .text(d.name || 'Unnamed Phenotype');

      // Description (if exists)
      if (d.description && !d.isSynthetic) {
        div.append('div')
          .style('font-size', '12px')
          .style('margin-bottom', '4px')
          .text(d.description);
      }

      // Count
      div.append('div')
        .style('font-size', '14px')
        .style('text-align', 'center')
        .html(`<span style="font-family: IBMPlexSans-bolditalic; margin-right: 5px;">n =</span>${d.count !== undefined ? d.count : '?'}`);

      // Horizontal arrow (if not hiding exclusion)
      if (!d.hideExclusion) {
        const arrowStartX = boxX + boxWidth / 2;
        const arrowEndX = EXCLUDED_BOX_OFFSET - 5;

        group.append('line')
          .attr('class', 'horizontal-arrow')
          .attr('x1', arrowStartX)
          .attr('y1', 15)
          .attr('x2', arrowEndX)
          .attr('y2', 15)
          .attr('stroke', textColor)
          .attr('stroke-width', 1)
          .attr('marker-end', 'url(#reportArrowhead)');

        // Excluded box
        const excludedBox = group.append('g')
          .attr('class', 'excluded-box')
          .attr('transform', `translate(${EXCLUDED_BOX_OFFSET}, 0)`);

        excludedBox.append('rect')
          .attr('width', EXCLUDED_BOX_WIDTH)
          .attr('height', 40)
          .attr('rx', 4)
          .attr('ry', 4)
          .attr('fill', backgroundColor || 'white')
          .attr('fill-opacity', 0.3)
          .attr('stroke', borderColor)
          .attr('stroke-width', 1);

        const excludedText = excludedBox.append('foreignObject')
          .attr('width', EXCLUDED_BOX_WIDTH)
          .attr('height', 40);

        const excludedDiv = excludedText.append('xhtml:div')
          .style('width', '100%')
          .style('height', '100%')
          .style('display', 'flex')
          .style('flex-direction', 'column')
          .style('justify-content', 'center')
          .style('padding', '4px 8px')
          .style('font-size', '10px')
          .style('color', textColor);

        excludedDiv.append('div').text('Excluded');
        excludedDiv.append('div')
          .html(`<span style="font-family: IBMPlexSans-bolditalic; margin-right: 3px;">n =</span>${d.excluded_count !== undefined ? d.excluded_count : (d.n_excluded !== undefined ? d.n_excluded : '34,872')}`);
      }
    });

  }, [rows, cohortId, onRowClick]);

  return (
    <div style={{ width: '100%', overflow: 'auto', padding: '20px' }}>
      <svg ref={svgRef} style={{ display: 'block' }} />
    </div>
  );
};
