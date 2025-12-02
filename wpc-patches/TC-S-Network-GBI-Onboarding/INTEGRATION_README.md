# WPC Integration for TC-S-Network-GBI-Onboarding

**WPC Version:** 1.0.0
**Build Date:** 2024-12-02
**Framework Detected:** nextjs-app

## Files to Add

1. Copy `components/tcs/WPCPanel.tsx` to your project's components folder

## Integration Steps

### Next.js App Router Integration

1. Copy the WPCPanel component:
   ```bash
   cp components/tcs/WPCPanel.tsx your-project/components/tcs/
   ```

2. Import and use in `app/page.tsx`:
   ```tsx
   import WPCPanel from '@/components/tcs/WPCPanel';
   
   export default function Page() {
     return (
       <main>
         {/* Your existing content */}
         <WPCPanel />
       </main>
     );
   }
   ```

3. Ensure your `tsconfig.json` has the path alias:
   ```json
   {
     "compilerOptions": {
       "paths": {
         "@/*": ["./*"]
       }
     }
   }
   ```

## Verification

After integration, you should see:
- A dark panel with "WPC Compute Intelligence" header
- Model type selector (LLM, Vision, Diffusion)
- Input controls for tokens/resolution, power, and time
- Real-time calculation of FLOPs, Energy, WPC, Solar, and Rays
- Efficiency grade badge (A+ to D)
- Version footer showing "TC-S Computronium Standard v1.0.0"

## Need Help?

Contact: TC-S Network Foundation
Repository: https://github.com/tdfranklin101-ui/TC-S-Network-Main-Gateway
