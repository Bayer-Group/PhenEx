import type { IJsonModel, IJsonRowNode, IJsonTabNode, IJsonTabSetNode } from 'flexlayout-react';

export const COMMENTS_COMPONENT = 'comments';

type LayoutNode = IJsonRowNode | IJsonTabSetNode | IJsonTabNode;

const COMMENTS_TABSET: IJsonTabSetNode = {
  type: 'tabset',
  weight: 20,
  children: [{ type: 'tab', name: 'Comments', component: COMMENTS_COMPONENT, enableClose: false }],
};

function isCommentsTabset(node: LayoutNode): node is IJsonTabSetNode {
  return (
    node.type === 'tabset'
    && node.children.length === 1
    && node.children[0].type === 'tab'
    && node.children[0].component === COMMENTS_COMPONENT
  );
}

function stripComments(node: LayoutNode): LayoutNode | null {
  if (isCommentsTabset(node)) return null;
  if (node.type !== 'row') return node;
  return {
    ...node,
    children: node.children
      .map(stripComments)
      .filter((child): child is LayoutNode => child !== null),
  };
}

/** True if the layout JSON contains a Comments tabset. */
export function hasCommentsTabset(json: IJsonModel): boolean {
  const walk = (node: LayoutNode): boolean => {
    if (isCommentsTabset(node)) return true;
    if (node.type === 'row') return node.children.some(walk);
    return false;
  };
  return walk(json.layout);
}

/** Remove the Comments tabset from a layout (other panel sizes are preserved). */
export function removeCommentsTabset(json: IJsonModel): IJsonModel {
  const layout = stripComments(json.layout);
  if (!layout || layout.type !== 'row') return json;
  return { ...json, layout };
}

/** Append the Comments tabset to the top-level row if it is missing. */
export function addCommentsTabset(json: IJsonModel): IJsonModel {
  if (hasCommentsTabset(json)) return json;
  if (json.layout.type !== 'row') return json;
  return {
    ...json,
    layout: {
      ...json.layout,
      children: [...json.layout.children, COMMENTS_TABSET],
    },
  };
}
