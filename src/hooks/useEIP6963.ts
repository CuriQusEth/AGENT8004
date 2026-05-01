import { useState, useEffect } from 'react';

export interface EIP6963ProviderInfo {
  uuid: string;
  name: string;
  icon: string;
  rdns: string;
}

export interface EIP6963ProviderDetail {
  info: EIP6963ProviderInfo;
  provider: any; // EIP-1193 provider
}

export function useEIP6963Providers() {
  const [providers, setProviders] = useState<EIP6963ProviderDetail[]>([]);

  useEffect(() => {
    function onAnnounceProvider(event: any) {
      if (event.detail && event.detail.info && event.detail.provider) {
        setProviders(prev => {
          if (prev.some(p => p.info.uuid === event.detail.info.uuid)) return prev;
          return [...prev, event.detail];
        });
      }
    }

    window.addEventListener('eip6963:announceProvider', onAnnounceProvider);
    window.dispatchEvent(new Event('eip6963:requestProvider'));

    return () => {
      window.removeEventListener('eip6963:announceProvider', onAnnounceProvider);
    };
  }, []);

  return providers;
}
