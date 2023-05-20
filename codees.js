
import search from "./index.js";
search('https://www.vinted.fr/vetements?brand_id[]=53&page=3').then((posts) => {
    console.log(posts);
    alert(posts[0]) // all the posts that match this query
});