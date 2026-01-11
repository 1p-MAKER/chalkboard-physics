import { useState, useEffect } from 'react';
import { Filesystem, Directory } from '@capacitor/filesystem';

interface AlbumImageProps {
    fileName: string;
    style?: React.CSSProperties;
    onClick?: () => void;
}

export const AlbumImage: React.FC<AlbumImageProps> = ({ fileName, style, onClick }) => {
    const [src, setSrc] = useState<string | null>(null);

    useEffect(() => {
        let isMounted = true;
        const loadImage = async () => {
            try {
                const file = await Filesystem.readFile({
                    path: fileName,
                    directory: Directory.Data
                });
                if (isMounted) {
                    // file.data is base64 string
                    setSrc(`data:image/jpeg;base64,${file.data}`);
                }
            } catch (e) {
                console.error('Failed to load image', fileName, e);
            }
        };
        loadImage();
        return () => { isMounted = false; };
    }, [fileName]);

    return (
        <div style={{ ...style, cursor: 'pointer', overflow: 'hidden', display: 'flex', justifyContent: 'center', alignItems: 'center', backgroundColor: '#eee' }} onClick={onClick}>
            {src ? (
                <img src={src} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="Album Photo" />
            ) : (
                <span style={{ color: '#aaa' }}>Loading...</span>
            )}
        </div>
    );
};
