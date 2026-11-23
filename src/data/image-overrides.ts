const batchOne = (name: string) => encodeURI(`/batch 1/${name}`);
const publicImage = (path: string) => encodeURI(path);

// Hand-matched corrections for products that previously had missing paths or
// shared generic placeholder images. These point to the real product images
// already bundled in /public, plus two generated clean catalogue visuals for
// products that had no exact usable image.
//
// === Word Document No.2 image overrides (27 products) ===
// These use the actual extracted PNG images from the attached Word document.
// #9 Cell Culture Cover Glass keeps its catalogue photo: the Word document only
// reuses the microscope-slide picture for it, which does not show cover glass.
export const productImageOverrides: Record<string, string> = {
  // ──── Amended_Website_Changes_2.docx (Nov 2026): new supplied product photos ────
  "121": publicImage("/product-photos/clear-reagent-bottle-250ml.png"), // 5. Clear Reagent Bottle 250ml
  "A046": publicImage("/product-photos/clear-reagent-bottle-250ml.png"), // 5. Clear Reagent Bottle 250ml
  "131": publicImage("/product-photos/inoculation-loop.png"), // 6. Inoculation Loop
  "155": publicImage("/product-photos/capillary-blood-collection-tube.png"), // 7. Capillary Blood Collection Tube
  "184": publicImage("/product-photos/pipette-tips-eppendorf-gilson.png"), // 8. Pipette Tips Fit For Eppendorf 10ul & Gilson
  "178": publicImage("/product-photos/multi-function-multi-bridge-rack.png"), // 9. Multi-Function Multi Bridge Rack
  "182": publicImage("/product-photos/pillar-like-tube-rack.png"), // 10. Pillar-Like Tube Rack
  "193": publicImage("/product-photos/sharp-scr-03g-3gal-container.png"), // 11. Sharp SCR-03G 3Gal Container
  "191": publicImage("/product-photos/sample-cups.png"), // 13. Sample Cups
  "211": publicImage("/product-photos/transfer-pipettes.png"), // 14. Transfer Pipettes
  "212": publicImage("/product-photos/transfer-pipettes.png"), // 14. Transfer Pipettes
  "214": publicImage("/product-photos/transport-swab-with-medium.png"), // 15. Transport Swab with Medium
  "252": publicImage("/product-photos/urine-container.png"), // 16. Urine Container
  "219": publicImage("/product-photos/urine-test-tube.png"), // 17. Urine Test Tube
  "220": publicImage("/product-photos/urine-transfer-device.png"), // 19. Urine Transfer Device
  "223": publicImage("/product-photos/waste-sharp-container-yellow.png"), // 20. Waste Sharp Container Yellow
  "185": publicImage("/product-photos/pipette-tips-eppendorf-gilson.png"), // 24. Pipette Tip Fit For Gilson 10ul, 200ul, 1000ul
  "187": publicImage("/product-photos/pipette-tips-eppendorf-gilson.png"), // 25. Pipette Tips Gilson Yellow 200ul BX of 1000
  "210": publicImage("/product-photos/transfer-pipettes.png"), // 26. Transfer Pipette 1ml-2ml
  "198": publicImage("/product-photos/stick-applicator.png"), // 27. Stick Applicator Bx 1000
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
  "112": publicImage("/products/150 ╬╝L 8mm Conical Bottom Vial Insert.jpg"),

  // ──── Word Doc overrides (Website_Document_No.2.docx; #19, #26 and #1/#20 further down) ────
  "125": publicImage("/imgs/image19.png"),  // 10. Cell Spreaders
  "128": publicImage("/imgs/image18.png"),  // 12. Culture Tubes with Dual-position Cap
  "130": publicImage("/imgs/image17.png"),  // 11. Bacteriological Petri Dishes
  "141": publicImage("/generated/pcl-microscope-slides.jpg"),
  "144": publicImage("/imgs/image20.png"),  // 15. Counting Chamber Slides
  "145": publicImage("/products/Latex Glass Slides.jpg"),
  "149": publicImage("/imgs/image10.png"),  // 2. 3M FACE MASK 1860 N95 PARTICULATE RESPIRATOR
  "151": publicImage("/imgs/image21.png"),  // 16. Adhesive Tapes (was adhesive Tape 2.5cm x 10cm)
  "153": publicImage("/imgs/image22.png"),  // 17. Blood Collection Tube Holder
  "161": publicImage("/imgs/image23.png"),  // 18. Cytology Brushes
  "164": batchOne("Disposable Pap Smear Kit.png"),
  "165": batchOne("Disposable Vacuum Blood Collection Tube (EDTA Tube) .jpg"),
  "171": batchOne("GAUZE SWAB GREEN 100X100 (100_Pkt).jpg"),
  "174": publicImage("/imgs/image1.png"),   // 21. Gloves Vinyl Latex
  "177": publicImage("/imgs/image2.png"),   // 22. Micropore Tape
  "179": publicImage("/imgs/image3.png"),   // 23. Sample Blood Collection Needles
  "183": publicImage("/imgs/image9.png"),   // 3. Serological (Pipette)
  "194": publicImage("/imgs/image11.png"),  // 5. Sleeve Protector
  "199": publicImage("/imgs/image4.png"),   // 24. Supreme Ster and Powder Free
  "200": publicImage("/imgs/image14.png"),  // 6. Syringes (Surgi Plus Luer Slip)
  "203": batchOne("Test Tube 12_75mm, PP .jpg"),
  "206": publicImage("/imgs/image13.png"),  // 7. 16×75mm Test Tube
  "213": publicImage("/imgs/image5.png"),   // 25. Transparent Surgical Tape
  "218": batchOne("Urine container 60 ml, 90 ml, 100 ml, 120 ml.jpg"),
  "221": publicImage("/imgs/image7.png"),   // 27. ESR Pipette Adaptor

  // ──── Remaining existing overrides (non-Word-doc products) ────
  "146": publicImage("/imgs/image8.png"),  // 1. 12*75mm Test Tube
  "147": batchOne("16_53mm Test Tube, 6ml with Cap.jpg"),
  "148": batchOne("25ul Transfer Pipette .jpg"),
  "150": batchOne("96 Well Tip Box for 10ul and 200ul .jpg"),
  "152": batchOne("ALCOHOL HAND SANITIZER (500ml).jpg"),
  "154": batchOne("BONE MARROW BIOPSY_ASPIRATION NEEDLE 10_BOX.jpg"),
  "156": batchOne("Cell Culture Bottle.jpg"),
  "158": batchOne("Cell Culture Flash.png"),
  "159": batchOne("Cell Culture Plate.jpg"),
  "160": publicImage("/generated/conductive-pipette-tips.jpg"),
  "162": batchOne("Disposable Blood Collection Tube (Serum Clot Activator Tube) .jpg"),
  "163": publicImage("/blood-collection/legacy/serum-gel-sharp.jpg?v=r"),
  "166": publicImage("/product-photos/vacuum-blood-collection-tube-glucose.png"), // supplied photo (Nov 2026)
  "167": batchOne("Disposable Vacuum Blood Collection Tube (Heparin with Separator Gel Tube).jpg"),
  "168": publicImage("/blood-collection/legacy/regular-tube.jpg?v=r"),
  "169": batchOne("ESR Pipettes.jpg"),
  "170": batchOne("FIRST AID BOX INCLUDING CONTENTS.jpg"),
  "172": publicImage("/imgs/image25.png"),  // 20. Gauze Swabs (white, 75x75 8-ply)
  "173": batchOne("Glass Test Tube .png"),
  "175": batchOne("LOOPS INNOCULATING 10UL DISPOSABLE ( 50 packs of 20 ) box_1000.jpg"),
  "176": batchOne("Micro Blood Collection Tubes .jpg"),
  "180": batchOne("PACKAGING TAPE, 48mm X 50m.jpg"),
  "181": publicImage("/generated/ph-eyewash-station.jpg"),
  "186": batchOne("Pipette tip.jpg"),
  "188": batchOne("Plastic spatula for blood smear.jpg"),
  "189": batchOne("REGULATIONS FIRST AID REFILL.jpg"),
  "192": publicImage("/blood-collection/legacy/butterfly-needle-sharp.jpg?v=r"),
  "195": batchOne("SLIDE TRAY PLASTIC (20 SLIDES) EA.jpg"),
  "196": batchOne("Spectrophotometer Cuvettes .jpg"),
  "197": batchOne("Stainless Steel Blood Lancet.png"),
  "201": batchOne("SWAB THROAT PLAIN 150MM X 100 Bx 1000.jpg"),
  "202": batchOne("SYRINGE 10ml   100_BOX.jpg"),
  "204": batchOne("Test Tube 15_150mm, 15ml.jpg"),
  "205": batchOne("Test Tube 15_60mm (Flat Bottom).jpg"),
  "207": batchOne("Test Tube with Graduation, 14.7_101mm with Cap.jpg"),
  "208": batchOne("Test Tube with Pipette 16_95mm.jpg"),
  "209": batchOne("tourniquet.jpg"),
  "215": batchOne("Universal Container-PPMaterial.png"),
  "216": publicImage("/generated/universal-filter-tips.jpg"),
  "217": batchOne("Urine and Stool Container.png"),
  "222": batchOne("VAGINAL SPECULUM.png"),
  "224": publicImage("/generated/clean-lab-product-kit.jpg"),
  "136": publicImage("/generated/specimen-container.jpg"),
  "250": publicImage("/generated/specimen-container.webp"),
  "256": publicImage("/generated/blood-collection-needle.webp"),
};

export const categoryImageOverrides: Record<string, string> = {
  "Laboratory Equipments": publicImage("/imgs/medical-laboratory-refrigerators-cold-storage.jpg"),
  "Blood Collection Tubes & Needles": publicImage("/blood-collection/tubes/Red_Clot_Activator_Tubes.jpg?v=r"),
};
