# 📱 Quick Visual Guide - Adding Your App Images

## What You Have (2 Images from your attachment)

### Image 1: Home Screen
- Shows: "Welcome back juanp..", "Track Live", "Quick Actions" section
- Features: Request Delivery, Track Order, My Addresses, Order History buttons
- **Save this as:** `app-home.png`

### Image 2: Order Summary  
- Shows: Order details with hand holding phone
- Features: Light Truck/FB Type, Pickup/Delivery locations, Price (₱806.40)
- **Save this as:** `app-order.png`

---

## Where to Put Them

```
📁 e:\SD-Admin\swiftdash-admin\
  └── 📁 public\
      └── 📁 assets\
          └── 📁 images\
              ├── 📄 app-home.png    ← Put Image 1 here
              ├── 📄 app-order.png   ← Put Image 2 here
              ├── 📄 app-store.svg
              ├── 📄 play-store.svg
              └── 📄 swiftdash_logo.png
```

---

## How They'll Look on Your Website

```
        📱                    📱
     (tilted               (tilted
      left)                right)
   ┌─────────┐          ┌─────────┐
   │         │          │         │
   │  HOME   │          │  ORDER  │
   │ SCREEN  │          │ SUMMARY │
   │         │          │         │
   └─────────┘          └─────────┘
   
   Hover effect: Phones straighten when you hover over them!
```

---

## Step-by-Step (Windows)

### Option 1: Drag and Drop
1. Open File Explorer
2. Navigate to: `e:\SD-Admin\swiftdash-admin\public\assets\images\`
3. Drag your 2 images into this folder
4. Rename them:
   - First image → `app-home.png`
   - Second image → `app-order.png`

### Option 2: Save Directly
1. Right-click each image attachment
2. Click "Save image as..."
3. Navigate to: `e:\SD-Admin\swiftdash-admin\public\assets\images\`
4. Name them:
   - First image → `app-home.png`
   - Second image → `app-order.png`

---

## Verify Everything Works

### Check files exist:
```powershell
cd e:\SD-Admin\swiftdash-admin
dir public\assets\images\app-*.png
```

You should see:
```
app-home.png
app-order.png
```

### Run the dev server:
```powershell
npm run dev
```

### Open browser:
```
http://localhost:9002
```

### Scroll down to see your app mockups! 🎉

---

## What You'll See

✨ **Section Title**: "Experience SwiftDash"
📱 **Two Phones**: Side by side with your actual app screens
🎨 **Beautiful Design**: Realistic phone frames with shadows
↔️ **Interactive**: Hover over phones to see them straighten
⚡ **Fast Loading**: Images are optimized with priority loading

---

## Troubleshooting

**Images not showing?**
- Check filenames are exactly: `app-home.png` and `app-order.png` (case-sensitive!)
- Make sure they're in the right folder: `public/assets/images/`
- Try hard refresh: `Ctrl + Shift + R`
- Restart dev server

**Wrong image in wrong position?**
- `app-home.png` should be the home screen (left phone)
- `app-order.png` should be the order summary (right phone)

---

## Need to Change Filenames?

Using PowerShell in the project root:

```powershell
# Rename images if needed
Rename-Item "public\assets\images\your-image-1.png" "app-home.png"
Rename-Item "public\assets\images\your-image-2.png" "app-order.png"
```

---

**That's it!** Your beautiful app mockups will be live on your homepage! 🚀
