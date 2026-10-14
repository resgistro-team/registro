# Hero asset credits

Everything in this folder is real data, resized for the web. The page itself carries no credit line, so this file is the attribution: keep it published next to the assets.

| File | Source | Terms |
|---|---|---|
| `earth-day.jpg` | NASA Earth Observatory, Blue Marble: Next Generation (December 2004, topography and bathymetry), resized to 2048x1024 | NASA media guidelines: not copyrighted, credit NASA, no implied endorsement |
| `earth-night.jpg` | NASA Earth Observatory, Black Marble 2016 colour map (3 km), resized to 4096x2048 | Same |
| `mid-night.jpg` | NASA Earth Observatory, Black Marble 2016 tiles A1 and B1 (500 m), stitched and cropped to lon -104..-72, lat 30..50, resized to 2560x1600 | Same |
| `region-night.jpg` | NASA Earth Observatory, Black Marble 2016 tile B1 (500 m), cropped to lon -89.6..-77.6, lat 37.25..47.25 | Same |
| `earth-clouds.jpg` | NASA Earth Observatory, Blue Marble cloud composite, 2048x1024 greyscale | Same |
| `milkyway.jpg` | NASA Scientific Visualization Studio, Deep Star Maps 2020 (Milky Way layer, celestial coordinates) | Same |
| `stars.bin` | HYG Database v4.1 (astronexus), the 8,920 stars of magnitude 6.5 or brighter | CC BY-SA 4.0: attribution required, derived data stays under the same licence |

`stars.bin` is little-endian float32, five values per star: unit direction `x, y, z`, apparent magnitude, B-V colour index. Rows are sorted brightest first.

The crop bounds of `mid-night.jpg` and `region-night.jpg` are duplicated as `MID` and `REGION` in `src/components/hero/descent-scene.ts`. Change both together.

NASA's insignia and logotype are not used and must not be added. Credit NASA as the source without implying it endorses Registro.
