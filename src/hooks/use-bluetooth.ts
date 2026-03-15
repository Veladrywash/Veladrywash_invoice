import { useState, useEffect } from 'react';

export function useBluetooth() {
  const [hasBluetooth] = useState(() => {
    return typeof navigator !== 'undefined' && 'bluetooth' in navigator;
  });
  const [isBrave, setIsBrave] = useState(false);

  useEffect(() => {
    const checkBrave = async () => {
      const nav = navigator as any;
      if (typeof nav.brave?.isBrave === 'function') {
        const result = await nav.brave.isBrave();
        setIsBrave(result);
      }
    };
    checkBrave();
  }, []);

  return { hasBluetooth, isBrave };
}
