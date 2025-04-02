const TypeCellRenderer = (props: any) => {
  const type = props.value;
  const colorClass = `rag-${type === 'entry' ? 'dark' : type === 'inclusion' ? 'blue' : type === 'exclusion' ? 'green' : type === 'baseline' ? 'coral' : type === 'outcome' ? 'red' : ''}-outer`;
  return (
    <div style={{ textAlign: 'left' }}>
      <span
        style={{
          // display: 'inline-block',
          padding: '2px 5px',
          borderRadius: '4px',
          backgroundColor: 'red',
          fontSize: '12px',
        }}
        className={colorClass}
      >
        {type}
      </span>
    </div>
  );
};

export default TypeCellRenderer;
