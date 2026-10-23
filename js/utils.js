const formatRp = (number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(number);
};

const formatDate = (dateString) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;
    return new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'long', year: 'numeric' }).format(date);
};

const getDirectImageUrl = (url) => {
       if (!url) return '';
       // Jika link lokal saat baru pilih file, langsung tampilkan
       if (String(url).startsWith('blob:') || String(url).startsWith('data:')) return url;
       
       const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/) || url.match(/id=([a-zA-Z0-9_-]+)/);
       if (match && match[1]) {
           // Menggunakan server Google UserContent & Thumbnail yang bebas blokir
           return `https://lh3.googleusercontent.com/d/${match[1]}`;
       }
       return url;
   };

const getDrivePreviewUrl = (url) => {
    if (!url) return '';
    const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/) || url.match(/id=([a-zA-Z0-9_-]+)/);
    if (match && match[1]) return `https://drive.google.com/file/d/${match[1]}/preview`;
    return url;
};

const getDriveThumbnailUrl = (url) => {
    if (!url) return '';
    const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/) || url.match(/id=([a-zA-Z0-9_-]+)/);
    if (match && match[1]) return `https://drive.google.com/thumbnail?id=${match[1]}&sz=w800`;
    return url;
};

const parseMapUrls = (input) => {
    if (!input) return { webUrl: '', appUrl: '', navUrl: '' };
    const clean = String(input).trim();
    if (!clean) return { webUrl: '', appUrl: '', navUrl: '' };

    const coordMatch = clean.match(/([-+]?[0-9]*\.?[0-9]+)\s*,\s*([-+]?[0-9]*\.?[0-9]+)/);
    const coords = coordMatch ? `${coordMatch[1]},${coordMatch[2]}` : null;

    let webUrl = clean;
    if (coords && !clean.startsWith('http')) {
        webUrl = `https://www.google.com/maps?q=${coords}`;
    } else if (!clean.startsWith('http')) {
        webUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(clean)}`;
    }

    const navUrl = coords
        ? `https://www.google.com/maps/dir/?api=1&destination=${coords}`
        : (clean.startsWith('http') ? clean : `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(clean)}`);

    const appUrl = coords ? `geo:${coords}?q=${coords}` : navUrl;

    return { webUrl, appUrl, navUrl };
};
