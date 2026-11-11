local Targeting = {}

-- Horizontal distance to `position` if it is within `range` and roughly in front of `root`.
function Targeting.InFront(root: BasePart, position: Vector3, range: number): number?
	local offset = position - root.Position
	local flat = Vector3.new(offset.X, 0, offset.Z)
	local distance = flat.Magnitude
	if distance > range or math.abs(offset.Y) > 15 then
		return nil
	end
	if distance > 3 and root.CFrame.LookVector:Dot(flat.Unit) < 0.2 then
		return nil
	end
	return distance
end

return Targeting
