// routes/mempools/index.get.ts
import { Request, Response } from "express";

export default (req: Request, res: Response) => {
  res.status(200).json({
    carousel: [
      {
        img: "/images/home-banner-wct-quest.png",
        auth: false,
        title: "carousel1Title",
        description: "carousel1Desc",
        buttons: [{ url: "/oauth/register", text: "carousel1Btn" }],
      },
      {
        img: "/images/home-banner-wct-quest.png",
        auth: true,
        title: "carousel2Title",
        description: "carousel2Desc",
        buttons: [{ url: "/earn", text: "carousel2Btn" }],
      },
      {
        img: "/images/home-banner-wct-quest.png",
        auth: true,
        title: "carousel3Title",
        description: "carousel3Desc",
        buttons: [{ url: "/earn", text: "carousel3Btn" }],
      },
    ],
    newListed: [
      //{ id: "" },
    ],
    gainers: [
      //{ id: "" },
    ],
    popular: [
      //{ id: "" },
    ],
  });
};
