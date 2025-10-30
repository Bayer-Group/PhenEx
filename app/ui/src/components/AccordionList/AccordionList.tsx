import React from 'react';
import styles from './AccordionList.module.css';
import { AccordionListItem, AccordionNode } from './AccordionListItem';

interface AccordionListProps {
  data: AccordionNode[];
}

const AccordionList: React.FC<AccordionListProps> = ({ data }) => {
  return (
    <div className={styles.accordionList}>
      {data.map((node, index) => {
        console.log("THIS IS ACCORDION NODE", node);
        const ItemComponent = node.renderer || AccordionListItem;
        return <ItemComponent key={`${node.displayName}-${index}`} node={node} />;
      })}
    </div>
  );
};

export default AccordionList;