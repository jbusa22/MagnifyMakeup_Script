const ProdChemExt = require("./ProdChemExt.js");
const listBannedChemicals = require("./list.js");
const findCas = require("./cas.js");
// The first part should go through each sephora link in the array of links (each category ie Skincare)
// For each link we run the testing.js code
// how do I call testing.js for every link if it is an async function that uses the browser?
// write a function that calls cas.js with an offset of 1000 every time
// if it fails then run it again otherwise add 1000 to the offset and keep going until end
// same thing for the list db
// potential problems: browser might not close
 // makeup
var makeup = ["foundation-makeup",
"bb-cc-cream-face-makeup","tinted-moisturizer","concealer","makeup-primer-face-primer", "setting-powder-face-powder", "color-correcting", "contour-palette-brush", "luminizer-luminous-makeup", "complexion-sets", "cheek-palettes", "blush", "bronzer-makeup", "contour", "cheek-highlighter", "eyeshadow-palettes", "mascara", "eyeliner", "eyebrow-makeup-pencils", "eyeshadow", "eyeprimer", "under-eye-concealer", "lipstick", "liquid-lipstick", "lip-stain", "lip-gloss", "lip-plumper"];
//skincare
var skincare = ["acne-treatment-blemish-remover", "anti-aging-skin-care", "dark-spot-remover", "dry-skin-treatment", "wrinkle-cream-remover", "skin-brighteners-dull-skin-treatments", "pore-minimizing-products", "moisturizer-skincare", "night-cream", "cleansing-oil-face-oil", "neck-cream-decollete", "face-mist-face-spray", "bb-cream-cc-cream", "face-wash-facial-cleanser", "exfoliating-scrub-exfoliator", "makeup-remover-skincare", "face-wipes", "facial-toner-skin-toner", "face-serum", "acne-products-acne-cream", "facial-peels"];
var combine = makeup.concat(skincare);
var preUrl = "https://www.sephora.com/shop/";
let maxConcurrent = 1;
async function processChemicals() {
for(let i = 0; i < combine.length; i++)
{
    // 30 and i gets to 60 62 products
    // i = 60 matches.length -1 = 61
    // the remainder is the same as the remainder of the max concurrent divided by total
    // After every "maxConcurrent" requests, block until everything is processed.
    // This will block and wait for all requests to come back and then process the data
    if ( (i % maxConcurrent == 0 || i % maxConcurrent == (combine.length -1) % maxConcurrent) && i !== 0)
    {
        let extractPromisesArray = [];
        for ( let y= i - maxConcurrent; y < i; y++ )
                extractPromisesArray[y] = new Promise( (resolve, reject) => { ProdChemExt.extractLinks( (preUrl + combine[y]), resolve,reject ); } );
        try
        {
            await Promise.all(extractPromisesArray);
        }
        catch ( e )
        {
            console.log( "Uncaught Error occured: " + e.message);
        }
        extractPromisesArray = [];
    }
}
    ProdChemExt.endpool();
}
(async () => {
    await processChemicals();
    await listBannedChemicals.processSQL();
    await findCas.processSQL();
}) ();


// for solutions in the form dy/dx equals f(y) just find where its zero and test points between to see if its stable or unstable
// for dy/dx = f(y)g(x) move it to int f(y)dy = int g(x)dx and solve for y
