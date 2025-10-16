# How to Add Your App Mockup Images

## Quick Instructions

You have 2 beautiful app mockup images. Here's how to add them:

### Step 1: Save the Images

Save your 2 images with these exact filenames:

1. **First image** (home screen with Track Live, Quick Actions, etc.)
   - Save as: `app-home.png`

2. **Second image** (order summary screen with hand holding phone)
   - Save as: `app-order.png`

### Step 2: Place in the Correct Folder

Put both images in:
```
e:\SD-Admin\swiftdash-admin\public\assets\images\
```

### Step 3: Final Structure

Your images folder should look like this:
```
public/assets/images/
├── app-home.png          ← FIRST IMAGE (home screen)
├── app-order.png         ← SECOND IMAGE (order summary)
├── app-store.svg         ✅ Already exists
├── play-store.svg        ✅ Already exists
├── swiftdash_logo.png    ✅ Already exists
└── README.md             ✅ Documentation
```

### Step 4: Image Specifications

Your current images are perfect! They show:
- **app-home.png**: Home screen with "Track Live", "Quick Actions" (Request Delivery, Track Order, My Addresses, Order History)
- **app-order.png**: Order summary screen showing delivery details and pricing (₱806.40)

The images will be displayed:
- Side by side
- With realistic phone frames
- Slight rotation effect (left phone -6°, right phone +6°)
- Hover effect to straighten
- Beautiful shadows and gradients

---

## PowerShell Commands to Help

### Check if images are in the right place:
```powershell
dir "e:\SD-Admin\swiftdash-admin\public\assets\images\app-*.png"
```

### Copy images (example):
```powershell
# If your images are in Downloads folder:
Copy-Item "$env:USERPROFILE\Downloads\image1.png" "e:\SD-Admin\swiftdash-admin\public\assets\images\app-home.png"
Copy-Item "$env:USERPROFILE\Downloads\image2.png" "e:\SD-Admin\swiftdash-admin\public\assets\images\app-order.png"
```

---

## What Changed in the Code

The mockup section now:
- ✅ Shows 2 phones instead of 3 (cleaner look)
- ✅ Uses your actual app screenshots
- ✅ Includes section title "Experience SwiftDash"
- ✅ Added gradient background
- ✅ Better phone frame styling with notches
- ✅ Hover effects to straighten phones
- ✅ Optimized for performance (priority loading)
- ✅ Proper alt text for accessibility

---

## Tips

✅ **Image Format**: PNG is perfect (already what you have)
✅ **Image Size**: Your images look like they're already good quality
✅ **Orientation**: Vertical (portrait) - ✅ Perfect!
✅ **Content**: Real app screens - ✅ Much better than mockups!

---

## Test It

1. Save both images with the correct filenames
2. Refresh your browser (or restart dev server)
3. Scroll to the app mockup section
4. You should see your beautiful app screens!
5. Hover over the phones to see the straighten effect

---

**Need Help?**

If images don't show:
- ✅ Check filenames are EXACTLY: `app-home.png` and `app-order.png`
- ✅ Check they're in `public/assets/images/` folder
- ✅ Try hard refresh: Ctrl+Shift+R (Windows) or Cmd+Shift+R (Mac)
- ✅ Restart dev server: Stop and run `npm run dev` again
