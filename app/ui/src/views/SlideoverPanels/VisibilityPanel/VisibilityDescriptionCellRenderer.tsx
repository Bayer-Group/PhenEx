import ReactMarkdown from 'react-markdown';


const VisibilityDescriptionCellRenderer = (props: any) => {
  const type = props.value;
  return (
    <div
      style={{
        textAlign: 'left',
        lineHeight: '1em',
        marginTop: '-5px',
        textWrap: 'wrap',
        top: '0px',
      }}
    >
        <ReactMarkdown>{type}</ReactMarkdown>
    </div>
  );
};

export default VisibilityDescriptionCellRenderer;
