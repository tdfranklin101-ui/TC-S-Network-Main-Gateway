# 3D Models for AR/VR Experiences

This directory contains 3D models used for AR/VR experiences on The Current-See website.

## Required Files:
- `solar-token.usdz` - Apple AR Quick Look model for iOS devices
- `solar-token.glb` - glTF Binary format for WebXR experiences

Note: These files need to be created with 3D modeling software and placed in this directory.
For production deployment, replace these placeholders with actual 3D models.

## Specifications:
- Recommended polygon count: <50,000 polygons
- Textures: 2K resolution maximum
- File size: <10MB for optimal loading

## AR Quick Look Compatibility:
The USDZ format is specifically for Apple's AR Quick Look feature, which allows iOS users
to view 3D objects in augmented reality directly from the web browser without needing to
download an app.