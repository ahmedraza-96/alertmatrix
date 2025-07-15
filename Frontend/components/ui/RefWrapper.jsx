import React, { forwardRef } from 'react';
import { View } from 'react-native';

/**
 * Universal ref wrapper component to handle forwardRef issues
 * Use this when getting "Function components cannot be given refs" errors
 */
const RefWrapper = forwardRef(({ children, Component = View, ...props }, ref) => {
  const WrappedComponent = Component;
  
  return (
    <WrappedComponent ref={ref} {...props}>
      {children}
    </WrappedComponent>
  );
});

RefWrapper.displayName = 'RefWrapper';

export default RefWrapper; 