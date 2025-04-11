import React, { useEffect, useRef } from 'react';
import styles from './DecorativeArrows.module.css';
import * as d3 from 'd3';

const DecorativeArrows: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Clear any existing SVG
    d3.select(containerRef.current).selectAll('svg').remove();

    // Create new SVG
    const svg = d3
      .select(containerRef.current)
      .append('svg')
      .attr('class', styles.arrows)
      .attr('viewBox', '0 0 200 200')
      .attr('xmlns', 'http://www.w3.org/2000/svg');

    // Create the curved arrow path
    const path = svg
      .append('path')
      .attr('class', styles.leftArrow)
      .attr('d', 'M 100 120 L 100 60 Q 100 40, 80 40 L 40 40')
      .attr('fill', 'none')
      .attr('stroke-linecap', 'round');

    // Create the arrow head
    svg.append('path').attr('class', styles.leftArrowHead).attr('d', 'M 40 40 L 50 35 L 50 45 Z');
  }, []);

  return <div ref={containerRef} className={styles.arrowsContainer}></div>;
};

export default DecorativeArrows;
