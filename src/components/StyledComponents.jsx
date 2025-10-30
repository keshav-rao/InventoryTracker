import styled from 'styled-components';
import { useState } from 'react';

const StyledDiv = styled.div`
  ${props => props.customStyle || ''}
`;

const CustomComponent = ({ style }) => {
  const [items, setItems] = useState([]);
  
  return (
    <>
      <div style={style || {}}></div>
      {items?.map(item => (
        <div key={item.id} style={item?.style || {}}>
          {item.content}
        </div>
      ))}
    </>
  );
};

CustomComponent.defaultProps = {
  style: {}
};

export { StyledDiv, CustomComponent };