const DescriptionCellRenderer = (props: any) => {
  const type = props.value;
  return (
    <div
      style={{
        textAlign: 'left',
        lineHeight: '1em',
        marginTop: '10px',
        textWrap: 'wrap',
      }}
    >
      {type}
    </div>
  );
};

export default DescriptionCellRenderer;
