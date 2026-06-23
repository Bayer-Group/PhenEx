import { FC, useCallback, useSyncExternalStore } from 'react';
import { Layout, type IJsonModel } from 'flexlayout-react';
import 'flexlayout-react/style/light.css';
import 'flexlayout-react/style/light.css';
import { useSharedModel, useCellLayoutStore } from './CellLayoutStore';
import { addCommentsTabset, removeCommentsTabset } from './cellLayoutComments';
import styles from './CellLayoutFrame.module.css';

interface CellLayoutFrameProps {
  rowType: string;
  defaultJson: IJsonModel;
  showCommentsToggle?: boolean;
  factory: (node: { getComponent: () => string | undefined }) => React.ReactNode;
}

/** FlexLayout wrapper with a single toggle that adds/removes the Comments tabset. */
export const CellLayoutFrame: FC<CellLayoutFrameProps> = ({
  rowType,
  defaultJson,
  showCommentsToggle = true,
  factory,
}) => {
  const store = useCellLayoutStore();
  const [model, propagateChange] = useSharedModel(rowType, defaultJson);

  const commentsVisible = useSyncExternalStore(
    (cb) => store.subscribe(cb),
    () => store.getCommentsVisible(rowType),
  );

  const handleModelChange = useCallback(() => {
    propagateChange(model);
  }, [model, propagateChange]);

  const toggleComments = useCallback(() => {
    const json = model.toJson() as IJsonModel;
    const nextVisible = !commentsVisible;
    const nextJson = nextVisible ? addCommentsTabset(json) : removeCommentsTabset(json);
    store.setCommentsVisible(rowType, nextVisible);
    store.setLayout(rowType, nextJson);
  }, [model, commentsVisible, rowType, store]);

  return (
    <div className={styles.frame}>
      {showCommentsToggle && (
        <button
          type="button"
          className={`${styles.commentsToggle} ${commentsVisible ? styles.commentsToggleActive : ''}`}
          title={commentsVisible ? 'Hide comments panel' : 'Show comments panel'}
          onClick={toggleComments}
        >
          {commentsVisible ? 'Hide comments' : 'Comments'}
        </button>
      )}
      <Layout model={model} factory={factory} onModelChange={handleModelChange} />
    </div>
  );
};
