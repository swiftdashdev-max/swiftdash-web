# Quick Guide: Adding App Mockup Images

## Step-by-Step Instructions

### 1. Prepare Your Images

Take 3 screenshots from your SwiftDash mobile app (iPhone or Android):
- **Recommended size:** 1080 x 2340 pixels (vertical/portrait orientation)
- **Format:** PNG (for best quality)
- **Content:** Choose your best app screens (e.g., home screen, order tracking, delivery confirmation)

### 2. Rename Your Images

Rename your screenshots to exactly these filenames:
```
app-mockup-1.png  (will appear on the LEFT, rotated -6°)
app-mockup-2.png  (will appear in the CENTER, larger and straight)
app-mockup-3.png  (will appear on the RIGHT, rotated +6°)
```

### 3. Upload to the Correct Location

Place all 3 images in this folder:
```
public/assets/images/
```

**Full path on your computer:**
```
e:\SD-Admin\swiftdash-admin\public\assets\images\
```

### 4. Final Structure

After adding your images, the folder should look like this:
```
public/assets/images/
├── app-mockup-1.png      ← YOUR NEW IMAGE
├── app-mockup-2.png      ← YOUR NEW IMAGE
├── app-mockup-3.png      ← YOUR NEW IMAGE
├── app-store.svg         ✅ Already exists (updated)
├── play-store.svg        ✅ Already exists (updated)
├── swiftdash_logo.png    ✅ Already exists
└── README.md             ✅ Documentation
```

### 5. Test It

1. Save your images in the correct location
2. Refresh your browser (or restart dev server)
3. The placeholder text will automatically disappear
4. Your app screenshots will show inside the phone frames!

---

## Tips for Best Results

✅ **DO:**
- Use high-quality screenshots (at least 1080px width)
- Use actual app screens from your SwiftDash app
- Make sure images are in PNG format
- Use vertical/portrait orientation

❌ **DON'T:**
- Don't use landscape/horizontal images
- Don't use images smaller than 1000px width
- Don't change the filenames (must match exactly)
- Don't put images in a different folder

---

## Troubleshooting

**Q: I added the images but they're not showing?**
- Check filenames are EXACTLY: `app-mockup-1.png`, `app-mockup-2.png`, `app-mockup-3.png`
- Make sure they're in `public/assets/images/` folder
- Try restarting the dev server: `npm run dev`
- Clear browser cache (Ctrl+Shift+R or Cmd+Shift+R)

**Q: Can I use JPG instead of PNG?**
- Yes! Just change the filename in `src/app/page.tsx` from `.png` to `.jpg`

**Q: My images look stretched or weird?**
- Make sure your images are vertical/portrait orientation
- Recommended aspect ratio: 9:19.5 (standard phone screen)

---

## Example Command (PowerShell)

To quickly check if your images are in the right place:
```powershell
dir "e:\SD-Admin\swiftdash-admin\public\assets\images\app-mockup-*.png"
```

You should see 3 files listed if they're in the correct location!

---

**Need help?** Check the images are:
1. ✅ Named correctly (app-mockup-1.png, app-mockup-2.png, app-mockup-3.png)
2. ✅ In the right folder (public/assets/images/)
3. ✅ Vertical orientation (taller than wide)
4. ✅ Good quality (at least 1080px width)
