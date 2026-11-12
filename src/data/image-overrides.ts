const batchOne = (name: string) => encodeURI(`/batch 1/${name}`);
const publicImage = (path: string) => encodeURI(path);

// Hand-matched corrections for products that previously had missing paths or
// shared generic placeholder images. These point to the real product images
// already bundled in /public, plus two generated clean catalogue visuals for
// products that had no exact usable image.
//
// === Word Document No.2 image overrides (27 products) ===
// These use the actual extracted PNG images from the attached Word document.
export const productImageOverrides: Record<string, string> = {
  "3": publicImage("/generated/laboratory-glass-bottles.jpg"),
  "18": publicImage("/Supplies/-20_25C FREEZER (Economic Type).webp"),
  "24": publicImage("/Supplies/Table Top Class B Autoclave.webp"),
  "25": publicImage("/products/table-top-class-b-autoclave-23l.jpg"),
  "52": publicImage("/generated/tabletop-class-b-autoclave.jpg"),
  "43": publicImage("/imgs/medical-laboratory-double-door-freezer.jpg"),
  "40": publicImage("/generated/freezer-40c-vseries.jpg"),
  "46": publicImage("/generated/freezer-25c-series.jpg"),
  "47": publicImage("/generated/freezer-30c-528l.jpg"),
  "49": publicImage("/generated/freezer-60c-series.jpg"),
  "80": publicImage("/generated/sputum-aspirator.webp"),
  "84": publicImage("/generated/air-water-syringe.webp"),
  "108": publicImage("/generated/micro-insert-300ul-flat.webp"),
  "109": publicImage("/generated/vial-insert-250ul-conical.webp"),
  "112": publicImage("/products/150 µL 8mm Conical Bottom Vial Insert.jpg"),

  // ──── Word Doc overrides (27 products from Website_Document_No.2.docx) ────
  "124": publicImage("/imgs/image15.png"),  // 9. Cell Culture Cover Glass
  "125": publicImage("/imgs/image19.png"),  // 10. Cell Spreaders
  "128": publicImage("/imgs/image18.png"),  // 12. Culture Tubes with Dual-position Cap
  "130": publicImage("/imgs/image17.png"),  // 11. Bacteriological Petri Dishes
  "140": publicImage("/imgs/image15.png"),  // 13. Plain Microscope Slides (same pic in Word doc)
  "141": publicImage("/generated/pcl-microscope-slides.jpg"),
  "144": publicImage("/imgs/image20.png"),  // 15. Counting Chamber Slides
  "145": publicImage("/products/Latex Glass Slides.jpg"),
  "149": publicImage("/imgs/image10.png"),  // 2. 3M FACE MASK 1860 N95 PARTICULATE RESPIRATOR
  "151": publicImage("/imgs/image21.png"),  // 16. adhesive Tape 2.5cm x 10cm
  "153": publicImage("/imgs/image22.png"),  // 17. Blood Collection Tube Holder
  "161": publicImage("/imgs/image23.png"),  // 18. Cytology Brushes
  "164": publicImage("/imgs/image15.png"),  // 14. Pap Smear Microscope Slide (same pic in Word doc)
  "165": publicImage("/imgs/image24.png"),  // 19. Disposable Vacuum Blood Collection Tubes
  "171": publicImage("/imgs/image25.png"),  // 20. Gauze Swabs
  "174": publicImage("/imgs/image1.png"),   // 21. Gloves Vinyl Latex
  "177": publicImage("/imgs/image2.png"),   // 22. Micropore Tape
  "179": publicImage("/imgs/image3.png"),   // 23. Sample Blood Collection Needles
  "183": publicImage("/imgs/image9.png"),   // 3. Serological (Pipette)
  "191": publicImage("/imgs/image12.png"),  // 4. Sample Cups
  "194": publicImage("/imgs/image11.png"),  // 5. Sleeve Protector
  "199": publicImage("/imgs/image4.png"),   // 24. Supreme Ster and Powder Free
  "200": publicImage("/imgs/image14.png"),  // 6. Syringes (Surgi Plus Luer Slip)
  "203": publicImage("/imgs/image8.png"),   // 1. 12×75mm Test Tube
  "206": publicImage("/imgs/image13.png"),  // 7. 16×75mm Test Tube
  "213": publicImage("/imgs/image5.png"),   // 25. Transparent Surgical Tape
  "214": publicImage("/imgs/image16.png"),  // 8. Transport Swab with medium
  "218": publicImage("/imgs/image6.png"),   // 26. Urine Container
  "221": publicImage("/imgs/image7.png"),   // 27. ESR Pipette Adaptor

  // ──── Remaining existing overrides (non-Word-doc products) ────
  "146": batchOne("12_75mm Test Tube, 5ml pp_ps.jpg"),
  "147": batchOne("16_53mm Test Tube, 6ml with Cap.jpg"),
  "148": batchOne("25ul Transfer Pipette .jpg"),
  "150": batchOne("96 Well Tip Box for 10ul and 200ul .jpg"),
  "152": batchOne("ALCOHOL HAND SANITIZER (500ml).jpg"),
  "154": batchOne("BONE MARROW BIOPSY_ASPIRATION NEEDLE 10_BOX.jpg"),
  "155": batchOne("Capillary Blood Collection Tube.jpg"),
  "156": batchOne("Cell Culture Bottle.jpg"),
  "157": batchOne("Cell Culture Dish.jpg"),
  "158": batchOne("Cell Culture Flash.png"),
  "159": batchOne("Cell Culture Plate.jpg"),
  "160": publicImage("/generated/conductive-pipette-tips.jpg"),
  "162": batchOne("Disposable Blood Collection Tube (Serum Clot Activator Tube) .jpg"),
  "163": publicImage("/blood-collection/legacy/serum-gel-sharp.jpg?v=r"),
  "166": batchOne("Disposable Vacuum Blood Collection Tube (Glucose Tube) .jpg"),
  "167": batchOne("Disposable Vacuum Blood Collection Tube (Heparin with Separator Gel Tube).jpg"),
  "168": publicImage("/blood-collection/legacy/regular-tube.jpg?v=r"),
  "169": batchOne("ESR Pipettes.jpg"),
  "170": batchOne("FIRST AID BOX INCLUDING CONTENTS.jpg"),
  "172": batchOne("GAUZE SWABS, 75X75X8 PLY, N_STERILE 100_Box.jpg"),
  "173": batchOne("Glass Test Tube .png"),
  "175": batchOne("LOOPS INNOCULATING 10UL DISPOSABLE ( 50 packs of 20 ) box_1000.jpg"),
  "176": batchOne("Micro Blood Collection Tubes .jpg"),
  "178": batchOne("Multi-Function Multi-Bridge Rack .jpg"),
  "180": batchOne("PACKAGING TAPE, 48mm X 50m.jpg"),
  "181": publicImage("/generated/ph-eyewash-station.jpg"),
  "182": batchOne("Pillar-like tube rack .jpg"),
  "184": batchOne("Pipette Tip Fit for Eppendorf 10ulπÇü200ULπÇü1000UL .jpg"),
  "185": batchOne("Pipette Tip Fit for Gilson 10ulπÇü200ULπÇü1000UL.jpg"),
  "186": batchOne("Pipette tip.jpg"),
  "187": batchOne("PIPETTE TIPS GILSON YELLOW 5-200UL BOX OF 1000.jpg"),
  "188": batchOne("Plastic spatula for blood smear.jpg"),
  "189": batchOne("REGULATIONS FIRST AID REFILL.jpg"),
  "190": batchOne("SAMPLE CUP PLASTIC 1ML- NESTING.jpg"),
  "192": publicImage("/blood-collection/legacy/butterfly-needle-sharp.jpg?v=r"),
  "193": batchOne("Sharp SCR-03G 3Gal Container .jpg"),
  "195": batchOne("SLIDE TRAY PLASTIC (20 SLIDES) EA.jpg"),
  "196": batchOne("Spectrophotometer Cuvettes .jpg"),
  "197": batchOne("Stainless Steel Blood Lancet.png"),
  "198": batchOne("STICK APPLICATOR BX 1000.jpg"),
  "201": batchOne("SWAB THROAT PLAIN 150MM X 100 Bx 1000.jpg"),
  "202": batchOne("SYRINGE 10ml   100_BOX.jpg"),
  "204": batchOne("Test Tube 15_150mm, 15ml.jpg"),
  "205": batchOne("Test Tube 15_60mm (Flat Bottom).jpg"),
  "207": batchOne("Test Tube with Graduation, 14.7_101mm with Cap.jpg"),
  "208": batchOne("Test Tube with Pipette 16_95mm.jpg"),
  "209": batchOne("tourniquet.jpg"),
  "210": batchOne("Transfer Pipette 1 mL - 2 mL .jpg"),
  "211": batchOne("Transfer Pipette 1 ml - 3.5 ml.jpg"),
  "212": batchOne("Transfer Pipette 1 mL - 5 mL.jpg"),
  "215": batchOne("Universal Container-PPMaterial.png"),
  "216": publicImage("/generated/universal-filter-tips.jpg"),
  "217": batchOne("Urine and Stool Container.png"),
  "219": batchOne("Urine Test Tube.jpg"),
  "220": batchOne("Urine Transfer Device for 100ml Urine Tube.jpg"),
  "222": batchOne("VAGINAL SPECULUM.png"),
  "223": batchOne("Waste a Sharp Container Rotary Collector Yellow 1l 3L 5L 7L 13L .jpg"),
  "224": publicImage("/generated/clean-lab-product-kit.jpg"),
  "136": publicImage("/generated/specimen-container.jpg"),
  "245": publicImage("/generated/vacuum-blood-tubes.webp"),
  "250": publicImage("/generated/specimen-container.webp"),
  "256": publicImage("/generated/blood-collection-needle.webp"),
};

export const categoryImageOverrides: Record<string, string> = {
  "Laboratory Equipments": publicImage("/imgs/medical-laboratory-refrigerators-cold-storage.jpg"),
  "Blood Collection Tubes & Needles": publicImage("/blood-collection/tubes/Red_Clot_Activator_Tubes.jpg?v=r"),
};
