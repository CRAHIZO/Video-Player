const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const stringSimilarity = require('string-similarity');

let videosCarpeta = ''; // Inicialmente vacío

function createWindow(fileName) {
    const mainWindow = new BrowserWindow({
        width: 800,
        height: 600,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: true,
            contextIsolation: false,
        }
    });

    mainWindow.loadFile(fileName);
}

app.whenReady().then(() => {
    createWindow('setFolder.html'); // Carga el HTML para ingresar la ruta

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow('setFolder.html');
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

// Manejar la ruta de la carpeta
ipcMain.handle('set-folder-path', (event, folderPath) => {
    if (fs.existsSync(folderPath) && fs.lstatSync(folderPath).isDirectory()) {
        videosCarpeta = folderPath;
        return 'Carpeta establecida correctamente';
    } else {
        return 'Ruta de carpeta inválida';
    }
});

// Manejar la búsqueda de archivos
ipcMain.handle('process-data', async (event, args) => {
    if (!videosCarpeta) {
        return 'Ruta de carpeta no establecida';
    }

    const archivos = fs.readdirSync(videosCarpeta);
    const videos = archivos.filter(file => file.endsWith('.mp4'));

    if (args.length <= 0) {
        // Devuelve 10 videos aleatorios
        const randomVideos = [];
        for (let i = 0; i < 10 && videos.length > 0; i++) {
            const randomIndex = Math.floor(Math.random() * videos.length);
            randomVideos.push({
                name: videos[randomIndex],
                path: `file://${path.join(videosCarpeta, videos[randomIndex])}`
            });
            videos.splice(randomIndex, 1); // Elimina el video seleccionado
        }
        return randomVideos;
    } else {
        // Algoritmo de búsqueda
        const matches = videos.map(file => {
            const lowerCaseFile = file.toLowerCase();
            let rating = stringSimilarity.compareTwoStrings(args.toLowerCase(), lowerCaseFile);

            const keywords = args.toLowerCase().split(" ");
            const keywordMatches = keywords.filter(keyword => lowerCaseFile.includes(keyword));

            if (keywordMatches.length === keywords.length) {
                rating += 0.4;
            } else if (keywordMatches.length > 0) {
                rating += 0.2;
            }

            if (keywords.every(keyword => lowerCaseFile.includes(keyword))) {
                rating += 0.5;
            }

            const lengthDifference = Math.abs(lowerCaseFile.length - args.length);
            rating -= (lengthDifference / 100);

            return {
                file: file,
                rating: rating
            };
        });

        matches.sort((a, b) => b.rating - a.rating);

        const topMatches = matches.slice(0, 10);

        function calculateSubStringSimilarity(query, fileName) {
            const lowerQuery = query.toLowerCase();
            const lowerFileName = fileName.toLowerCase();
            const score = lowerFileName.includes(lowerQuery) ? 1 : 0;
            return score;
        }

        const videosEncontrados = topMatches.map(match => {
            return {
                name: match.file,
                path: `file://${path.join(videosCarpeta, match.file)}`
            };
        });

        return videosEncontrados;
    }
});

