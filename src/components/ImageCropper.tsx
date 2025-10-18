import { useState, useCallback } from 'react';
import Cropper from 'react-easy-crop';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Slider } from '@/components/ui/slider';

interface ImageCropperProps {
  image: string;
  open: boolean;
  onClose: () => void;
  onCropComplete: (croppedImage: string) => void;
}

export function ImageCropper({ image, open, onClose, onCropComplete }: ImageCropperProps) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState([1]);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null);

  const onCropChange = useCallback((crop: { x: number; y: number }) => {
    setCrop(crop);
  }, []);

  const onZoomChange = useCallback((zoom: number) => {
    setZoom([zoom]);
  }, []);

  const onCropCompleteCallback = useCallback(
    (croppedArea: any, croppedAreaPixels: any) => {
      setCroppedAreaPixels(croppedAreaPixels);
    },
    []
  );

  const createImage = (url: string): Promise<HTMLImageElement> =>
    new Promise((resolve, reject) => {
      const image = new Image();
      image.addEventListener('load', () => resolve(image));
      image.addEventListener('error', (error) => reject(error));
      image.src = url;
    });

  const getCroppedImg = async (
    imageSrc: string,
    pixelCrop: any
  ): Promise<string> => {
    const image = await createImage(imageSrc);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      throw new Error('No se pudo obtener el contexto 2D del canvas');
    }

    // Set canvas size to match the cropped area
    canvas.width = pixelCrop.width;
    canvas.height = pixelCrop.height;

    // Draw the cropped image
    ctx.drawImage(
      image,
      pixelCrop.x,
      pixelCrop.y,
      pixelCrop.width,
      pixelCrop.height,
      0,
      0,
      pixelCrop.width,
      pixelCrop.height
    );

    // Create circular mask
    const circularCanvas = document.createElement('canvas');
    circularCanvas.width = pixelCrop.width;
    circularCanvas.height = pixelCrop.height;
    const circularCtx = circularCanvas.getContext('2d');

    if (!circularCtx) {
      throw new Error('No se pudo obtener el contexto 2D del canvas circular');
    }

    // Draw the circular mask
    circularCtx.beginPath();
    circularCtx.arc(
      pixelCrop.width / 2,
      pixelCrop.height / 2,
      pixelCrop.width / 2,
      0,
      Math.PI * 2
    );
    circularCtx.clip();

    // Draw the cropped image onto the circular canvas
    circularCtx.drawImage(canvas, 0, 0);

    return circularCanvas.toDataURL('image/png');
  };

  const handleSave = async () => {
    try {
      if (!croppedAreaPixels) {
        alert('Por favor espera un momento antes de aplicar el recorte');
        return;
      }
      const croppedImage = await getCroppedImg(image, croppedAreaPixels);
      onCropComplete(croppedImage);
      onClose();
    } catch (error) {
      alert(`Error al procesar la imagen: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    }
  };

  const handleClose = () => {
    setCrop({ x: 0, y: 0 });
    setZoom([1]);
    setCroppedAreaPixels(null);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Ajustar Foto de Perfil</DialogTitle>
        </DialogHeader>
        <div className="relative h-[400px] bg-black rounded-lg overflow-hidden">
          <Cropper
            image={image}
            crop={crop}
            zoom={zoom[0]}
            aspect={1}
            onCropChange={onCropChange}
            onZoomChange={onZoomChange}
            onCropComplete={onCropCompleteCallback}
            cropShape="round"
            showGrid={false}
          />
        </div>
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Zoom</label>
            <Slider
              value={zoom}
              min={1}
              max={3}
              step={0.1}
              onValueChange={(value) => setZoom(value)}
              className="w-full"
            />
          </div>
          <p className="text-sm text-muted-foreground">
            Arrastra la imagen para ajustar la posición y usa el zoom para acercar o alejar
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancelar
          </Button>
          <Button onClick={handleSave}>
            Aplicar Recorte
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

