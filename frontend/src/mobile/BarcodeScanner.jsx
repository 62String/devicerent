import { useEffect, useRef } from 'react';
import Quagga from 'quagga';

const BarcodeScanner = ({ onScan, onError }) => {
  const scannerRef = useRef(null);

  useEffect(() => {
    Quagga.init({
      inputStream: {
        name: 'Live',
        type: 'LiveStream',
        target: scannerRef.current,
        constraints: {
          width: 640,
          height: 480,
          facingMode: 'environment' // 후면 카메라
        }
      },
      decoder: {
        readers: ['code_128_reader', 'ean_reader', 'qr_code_reader'] // 바코드 종류
      }
    }, (err) => {
      if (err) {
        console.error('Quagga initialization failed:', err);
        if (onError) onError('카메라를 초기화하는 데 실패했습니다.');
        return;
      }
      Quagga.start();
    });

    Quagga.onDetected((data) => {
      const code = data.codeResult.code; // 스캔된 바코드 데이터
      if (onScan) onScan(code);
      Quagga.stop(); // 스캔 후 중지
    });

    return () => {
      Quagga.stop();
    };
  }, [onScan, onError]);

  return (
    <div>
      <div ref={scannerRef} style={{ width: '100%', height: 'auto' }} />
    </div>
  );
};

export default BarcodeScanner;