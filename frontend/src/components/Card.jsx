import React, { useContext } from 'react'
import { UserDataContext } from "../context/userDataContext";

function Card({ image }) {

    const { 
        frontendImage, setFrontendImage, 
        backendImage, setBackendImage,
        selectedImage, setSelectedImage 
    } = useContext(UserDataContext);

    return (
        <div
            className={`w-[200px] bg-[#030326] border-2 border-[blue] rounded-2xl cursor-pointer
            ${selectedImage === image ? "border-4 border-white shadow-2xl shadow-blue-800" : ""}`}
            onClick={() => {
                setSelectedImage(image)
                setFrontendImage(null)
                setBackendImage(null)
            }}
        >
            <img
                src={image}
                className="w-full h-full object-cover rounded-2xl"
                alt="avatar"
            />
        </div>
    )
}

export default Card
