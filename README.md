# PharmaWholesale B2B App - Installation & Hosting Guide

This application is designed to work as a Progressive Web App (PWA) with full offline support, making it perfect for field sales agents who might not always have internet access.

## 📱 Installing on Devices (Laptops, Tablets, Phones)

Because this app is a PWA, it can be installed directly from the browser without going through an app store.

### For iOS (iPhone/iPad)
1. Open the application URL in **Safari**.
2. Tap the **Share** button (the square with an arrow pointing up) at the bottom of the screen.
3. Scroll down and tap **"Add to Home Screen"**.
4. Tap **"Add"** in the top right corner.
5. The app will now appear on your home screen and function like a native app.

### For Android
1. Open the application URL in **Chrome**.
2. A prompt should appear at the bottom of the screen saying **"Add to Home Screen"**. Tap it.
3. If the prompt doesn't appear, tap the three-dot menu icon in the top right corner.
4. Select **"Install app"** or **"Add to Home screen"**.
5. Follow the on-screen instructions.

### For Laptops/Desktops (Windows/Mac)
1. Open the application URL in **Chrome** or **Edge**.
2. Look for the **Install icon** (a small computer with a downward arrow) on the right side of the address bar.
3. Click it and select **"Install"**.
4. The app will be installed and can be launched from your Start menu or Applications folder.

---

## 🌐 Hosting on a Server

To host this application for production use, you need to build the static files and serve them using a web server.

### 1. Build the Application
First, generate the production build:
```bash
npm run build
```
This will create a `dist` folder containing all the optimized static files.

### 2. Hosting Options

#### Option A: Firebase Hosting (Recommended)
Since you are already using Firebase Firestore, Firebase Hosting is the easiest and most integrated solution.
1. Install Firebase CLI: `npm install -g firebase-tools`
2. Login to Firebase: `firebase login`
3. Initialize hosting: `firebase init hosting`
   - Select your existing Firebase project.
   - Set the public directory to `dist`.
   - Configure as a single-page app (rewrite all urls to `/index.html`): **Yes**.
   - Set up automatic builds and deploys with GitHub: **No** (or Yes if desired).
4. Deploy: `firebase deploy --only hosting`

#### Option B: Vercel or Netlify
1. Push your code to a GitHub repository.
2. Connect the repository to Vercel or Netlify.
3. Set the build command to `npm run build`.
4. Set the output directory to `dist`.
5. Deploy.

#### Option C: Traditional Web Server (Nginx/Apache)
1. Copy the contents of the `dist` folder to your web server's root directory (e.g., `/var/www/html`).
2. Configure your server to route all requests to `index.html` to support client-side routing.

**Nginx Example:**
```nginx
server {
    listen 80;
    server_name yourdomain.com;
    root /var/www/html;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

---

## 📡 Offline Capabilities & Image Storage

- **Offline Mode:** The app uses Firebase's `persistentLocalCache`. When field agents lose internet connection, they can still view the catalog, create orders, and save them. The data is stored locally on their device.
- **Synchronization:** Once the device reconnects to the internet, Firebase automatically synchronizes the locally saved orders with the cloud database.
- **Image Storage:** All product images are stored as URLs in the Firestore database. When the app is online, the browser caches these images. For permanent storage of new images, you should upload them to a service like Firebase Storage and save the resulting URL in the product's `imagenUrl` field. Currently, the app uses external URLs which are cached by the PWA service worker for offline viewing.
