import React, { useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import * as d3 from 'd3';
import { getHierarchicalBackgroundColor, getAlphaForLevel } from '@/views/CohortViewer/CohortTable/CellRenderers/PhenexCellRenderer';

// D3-specific helper to compute actual RGBA colors from CSS variables
const getD3HierarchicalBackgroundColor = (
  effectiveType: string | undefined,
  hierarchicalIndex: string | undefined
): string => {
  if (!effectiveType) return 'transparent';
  
  // Get the alpha percentage (hex string like '25', '15', etc)
  const alphaHex = getAlphaForLevel(hierarchicalIndex);
  const alphaPercent = parseInt(alphaHex, 16) / 255 * 100;
  
  // Get the actual color value from CSS variable
  const cssVarName = `--color_${effectiveType}`;
  const computedColor = getComputedStyle(document.documentElement).getPropertyValue(cssVarName).trim();
  
  if (!computedColor) return 'transparent';
  
  // Parse RGB from computed color (handles rgb(), rgba(), hex, etc)
  const tempDiv = document.createElement('div');
  tempDiv.style.color = computedColor;
  document.body.appendChild(tempDiv);
  const rgbColor = getComputedStyle(tempDiv).color;
  document.body.removeChild(tempDiv);
  
  // Extract RGB values from rgb(r, g, b) format
  const match = rgbColor.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
  if (!match) return 'transparent';
  
  const [_, r, g, b] = match;
  const alpha = alphaPercent / 100;
  
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

// Helper to get computed color from CSS variable
const getComputedColorFromVar = (varName: string, fallback: string = '#333'): string => {
  const cssVarName = varName.replace('var(', '').replace(')', '').trim();
  const computedValue = getComputedStyle(document.documentElement).getPropertyValue(cssVarName).trim();
  return computedValue || fallback;
};

// D3-specific helper to get text color (full color, no alpha adjustment)
const getD3HierarchicalTextColor = (effectiveType: string | undefined): string => {
  if (!effectiveType) return '#333';
  
  // Get the actual color value from CSS variable
  const cssVarName = `--color_${effectiveType}`;
  const computedColor = getComputedStyle(document.documentElement).getPropertyValue(cssVarName).trim();
  
  if (!computedColor) return '#333';
  
  // Parse to RGB format
  const tempDiv = document.createElement('div');
  tempDiv.style.color = computedColor;
  document.body.appendChild(tempDiv);
  const rgbColor = getComputedStyle(tempDiv).color;
  document.body.removeChild(tempDiv);
  
  return rgbColor; // Returns rgb(r, g, b) format
};

interface CohortDefinitionReportD3Props {
  rows: any[];
  cohortId: string;
  onRowClick?: (row: any, index: number) => void;
}

export interface CohortDefinitionReportD3Ref {
  exportToSVG: () => void;
  exportToPNG: () => Promise<void>;
}

export const CohortDefinitionReportD3 = forwardRef<CohortDefinitionReportD3Ref, CohortDefinitionReportD3Props>((
  {
    rows,
    cohortId,
    onRowClick,
  },
  ref
) => {
  const svgRef = useRef<SVGSVGElement>(null);

  const exportToSVG = () => {
    if (!svgRef.current) return;
    
    const svgElement = svgRef.current;
    const svgData = new XMLSerializer().serializeToString(svgElement);
    const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);
    const link = document.createElement('a');
    link.download = `cohort_${cohortId}_flowchart.svg`;
    link.href = url;
    link.click();
    URL.revokeObjectURL(url);
  };

  const exportToPNG = async () => {
    if (!svgRef.current) return;
    
    const svgElement = svgRef.current;
    const svgData = new XMLSerializer().serializeToString(svgElement);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const img = new Image();
    const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);
    
    return new Promise<void>((resolve) => {
      img.onload = () => {
        canvas.width = img.width * 2; // 2x resolution
        canvas.height = img.height * 2;
        ctx.scale(2, 2);
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
        
        canvas.toBlob((blob) => {
          if (blob) {
            const pngUrl = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.download = `cohort_${cohortId}_flowchart.png`;
            link.href = pngUrl;
            link.click();
            URL.revokeObjectURL(pngUrl);
          }
          URL.revokeObjectURL(url);
          resolve();
        }, 'image/png');
      };
      img.src = url;
    });
  };

  useImperativeHandle(ref, () => ({
    exportToSVG,
    exportToPNG,
  }));

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
      .attr('viewBox', `0 0 ${totalWidth} ${totalHeight}`)
      .attr('data-cohort-flowchart', cohortId)
      .attr('data-cohort-name', allRows[1]?.name || 'Cohort'); // Store cohort name for filename

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
        // Calculate box center based on actual box width
        const nameLength = (d.name || 'Unnamed').length;
        const boxWidth = Math.min(Math.max(nameLength * 8, 100), 300);
        const boxX = BOX_CENTER_X - boxWidth / 2;
        const boxCenterX = boxX + boxWidth / 2;
        return `translate(${boxCenterX - 10}, ${y})`;
      });

    verticalArrows.append('line')
      .attr('x1', 10)
      .attr('y1', 0)
      .attr('x2', 10)
      .attr('y2', 35)
      .attr('stroke', (d: any) => {
        if (d.isSynthetic) return '#555';
        const colorVar = d.effective_type ? `var(--color_${d.effective_type})` : '#555';
        const computed = getComputedStyle(document.documentElement).getPropertyValue(`--color_${d.effective_type}`);
        return computed || '#555';
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

    // Helper function to compute actual CSS color values
    const getComputedColor = (varName: string, fallback: string = '#333'): string => {
      if (!varName.startsWith('var(')) return varName;
      return getComputedColorFromVar(varName, fallback);
    };

    // Draw phenotype boxes
    rowGroups.each(function(d: any, i) {
      const group = d3.select(this);
      
      // Use D3-specific functions that return actual RGB/RGBA colors
      const backgroundColor = getD3HierarchicalBackgroundColor(d.effective_type, d.hierarchical_index);
      const textColor = getD3HierarchicalTextColor(d.effective_type);
      const borderColorVar = d.effective_type ? `var(--color_${d.effective_type}_dim)` : '#333';
      
      // Compute border color from CSS variable
      const borderColor = getComputedColor(borderColorVar, '#333');

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
        .attr('fill', backgroundColor || 'transparent')
        .style('pointer-events', 'none');

      // Text content using native SVG text elements
      const textGroup = boxGroup.append('g')
        .attr('class', 'text-content')
        .style('pointer-events', 'none');

      let currentY = 16;

      // Name
      textGroup.append('text')
        .attr('x', boxWidth / 2)
        .attr('y', currentY)
        .attr('text-anchor', 'middle')
        .attr('fill', textColor)
        .style('font-size', '14px')
        .style('font-weight', '500')
        .text(d.name || 'Unnamed Phenotype');

      currentY += d.description && !d.isSynthetic ? 16 : 20;

      // Description (if exists)
      if (d.description && !d.isSynthetic) {
        textGroup.append('text')
          .attr('x', boxWidth / 2)
          .attr('y', currentY)
          .attr('text-anchor', 'middle')
          .attr('fill', textColor)
          .style('font-size', '12px')
          .text(d.description);
        currentY += 16;
      }

      // Count (n = value)
      const countGroup = textGroup.append('text')
        .attr('x', boxWidth / 2)
        .attr('y', currentY)
        .attr('text-anchor', 'middle')
        .attr('fill', textColor)
        .style('font-size', '14px');

      countGroup.append('tspan')
        .style('font-family', 'IBMPlexSans-bolditalic')
        .text('n = ');

      countGroup.append('tspan')
        .text(d.count !== undefined ? d.count : '?');

      // Horizontal arrow (if not hiding exclusion)
      if (!d.hideExclusion) {
        const arrowStartX = boxX + boxWidth;
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
          .attr('fill', backgroundColor || 'transparent')
          .attr('stroke', borderColor)
          .attr('stroke-width', 1);

        // Excluded text using native SVG
        const excludedTextGroup = excludedBox.append('g')
          .attr('class', 'excluded-text');

        excludedTextGroup.append('text')
          .attr('x', EXCLUDED_BOX_WIDTH / 2)
          .attr('y', 15)
          .attr('text-anchor', 'middle')
          .attr('fill', textColor)
          .style('font-size', '10px')
          .text('Excluded');

        const excludedCountText = excludedTextGroup.append('text')
          .attr('x', EXCLUDED_BOX_WIDTH / 2)
          .attr('y', 28)
          .attr('text-anchor', 'middle')
          .attr('fill', textColor)
          .style('font-size', '10px');

        excludedCountText.append('tspan')
          .style('font-family', 'IBMPlexSans-bolditalic')
          .text('n = ');

        excludedCountText.append('tspan')
          .text(d.excluded_count !== undefined ? d.excluded_count : (d.n_excluded !== undefined ? d.n_excluded : '34,872'));
      }
    });

  }, [rows, cohortId, onRowClick]);

  return (
    <div style={{ width: '100%', overflow: 'auto', padding: '20px' }}>
      <svg ref={svgRef} style={{ display: 'block' }} />
    </div>
  );
});

CohortDefinitionReportD3.displayName = 'CohortDefinitionReportD3';
