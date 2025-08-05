import { Router } from 'express';
import { sendContactMessage } from "../controllers/contac-us";


export default (router:Router)=>{
router.post("/contact-us", sendContactMessage);

}

