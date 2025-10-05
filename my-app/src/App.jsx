import './App.css'
import ThreeDPage from './pages/ThreeDPage'
import { Route, Routes } from 'react-router-dom'
import HomePage from './pages/HomePage'

function App() {
  

  return (
    <>
    <Routes>
      <Route path="/" element={ <HomePage/> }/>
      <Route path="/GUI" element={<ThreeDPage/>}/>
    </Routes>
      
    </>
  )
}

export default App
