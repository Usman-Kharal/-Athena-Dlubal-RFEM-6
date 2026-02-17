from pydantic import BaseModel, Field, model_validator, ValidationInfo
from typing import Literal, Optional
from enum import Enum

class InputVia(str, Enum):
    DEFINE_L1 = "define_L1"
    DEFINE_L2 = "define_L2"
    DEFINE_L1_L2 = "define_L1_L2"

class RFEMBlockModel(BaseModel):
    """
    Pydantic model for the Parabolic Truss Bridge RFEM block.
    """
    # Geometry Parameters
    n: int = Field(6, ge=2, le=50, description="Number of bays, must be even")
    input_via: InputVia = Field(InputVia.DEFINE_L1, description="Selection method for bay lengths")
    
    L: Optional[float] = Field(12.0, ge=0.1, le=50.0, description="Total length")
    L_1: Optional[float] = Field(2.0, ge=0.1, le=50.0, description="Length of outer bays (L1)")
    L_2: Optional[float] = Field(2.0, ge=0.1, le=50.0, description="Length of inner bays (L2)")
    
    H: float = Field(1.5, ge=0.0, le=50.0, description="Height of curve")
    H_1: float = Field(1.5, ge=0.0, le=50.0, description="Height")
    
    # Section IDs (referencing IDs in RFEM)
    section_top_chord: int = Field(1, description="ID of Top Chord Section")
    section_bottom_chord: int = Field(2, description="ID of Bottom Chord Section")
    section_diagonals: int = Field(3, description="ID of Diagonal Section")
    section_verticals: int = Field(4, description="ID of Vertical Section")
    
    # Support IDs
    support_left: int = Field(1, description="ID of Left Nodal Support")
    support_right: int = Field(2, description="ID of Right Nodal Support")

    @model_validator(mode='after')
    def check_parity_of_n(self) -> 'RFEMBlockModel':
        if self.n % 2 != 0:
            raise ValueError("Number of bays (n) must be even.")
        return self

    @model_validator(mode='after')
    def calculate_dependents(self) -> 'RFEMBlockModel':
        """
        Calculates dependent geometric parameters based on 'input_via' mode.
        This mirrors the logic in the JS block to ensure consistency.
        """
        n = self.n
        input_via = self.input_via
        
        # We access values directly. Since they are Optional, we should handle them safely.
        # However, defaults are provided, so they shouldn't be None generally unless set explicitly to None.
        L = self.L or 12.0
        L_1 = self.L_1 or 2.0
        L_2 = self.L_2 or 2.0

        if input_via == InputVia.DEFINE_L1:
            # L and L1 are inputs, calculate L2
            # Formula: L_2 = (L - 2*L_1)/(n - 2)
            if n > 2:
                self.L_2 = (L - 2 * L_1) / (n - 2)
            else:
                self.L_2 = 0.0 # Edge case handling
                
        elif input_via == InputVia.DEFINE_L2:
            # L and L2 are inputs, calculate L1
            # Formula: L_1 = (L - (n - 2)*L_2)/2
            self.L_1 = (L - (n - 2) * L_2) / 2
            
        elif input_via == InputVia.DEFINE_L1_L2:
            # L1 and L2 are inputs, calculate L
            # Formula: L = (n - 2)*L_2 + 2*L_1
            self.L = (n - 2) * L_2 + 2 * L_1
            
        return self

    def to_rfem_params(self):
        """
        Exports the parameters in a dictionary format suitable for RFEM logic/scripts.
        """
        return self.model_dump()
